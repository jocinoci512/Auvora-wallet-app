import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type AiAssistantType,
  type AiConversation,
  type AiMessage,
  type AiRequest,
  type Prisma,
} from '@auvora/database';
import {
  AiEventType,
  DEFAULT_MAX_INPUT_LENGTH,
  estimateCostUsdMicros,
  EVENT_BUS,
  runSafetyChecks,
  sanitizeOutput,
  SafetyViolationError,
  type ChatMessageInput,
  type EventBusPort,
} from '../../domain';
import { getAssistantDefaultSystemPrompt, getAssistantPromptCode } from '../assistant-registry';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { REQUEST_CACHE, type RequestCachePort } from '../ports/provider.tokens';
import { AuditService } from './audit.service';
import { ConversationService } from './conversation.service';
import { ModelRouterService } from './model-router.service';
import { PromptService } from './prompt.service';
import { VectorSearchService, type KnowledgeSearchResult } from './vector-search.service';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';

export interface ChatInput {
  ownerUserId: string;
  conversationId?: string;
  assistantType?: AiAssistantType;
  message: string;
  providerCode?: string;
  useKnowledge?: boolean;
  knowledgeSourceIds?: string[];
  correlationId?: string;
}

export interface ChatOutput {
  conversation: AiConversation;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  request: AiRequest;
  cached: boolean;
  citations: KnowledgeSearchResult[];
}

interface CachedChatPayload {
  content: string;
  providerCode: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Main chat orchestration: safety filter -> conversation context -> optional RAG retrieval ->
 * assistant prompt rendering -> cache check -> model router chat (with failover) -> persistence
 * of messages/request/usage/metrics -> audit trail -> domain event.
 */
@Injectable()
export class ChatService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(ConversationService) private readonly conversations: ConversationService,
    @Inject(PromptService) private readonly prompts: PromptService,
    @Inject(ModelRouterService) private readonly modelRouter: ModelRouterService,
    @Inject(REQUEST_CACHE) private readonly cache: RequestCachePort,
    @Inject(VectorSearchService) private readonly vectorSearch: VectorSearchService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
  ) {}

  async chat(input: ChatInput): Promise<ChatOutput> {
    // Always set, even for internal/system-triggered chats that don't supply one, so every
    // AiRequest/audit record/domain event for this call can be correlated end-to-end.
    const correlationId = input.correlationId ?? randomUUID();

    const safety = runSafetyChecks(input.message, DEFAULT_MAX_INPUT_LENGTH);
    if (!safety.allowed) {
      throw new SafetyViolationError(safety.reason);
    }
    const redactedMessage = safety.redactedInput;

    const conversation = input.conversationId
      ? await this.conversations.get(input.conversationId)
      : await this.conversations.create({
          ownerUserId: input.ownerUserId,
          assistantType: input.assistantType,
        });
    this.conversations.assertOwner(conversation, input.ownerUserId, false);

    const assistantType = conversation.assistantType;
    let systemPrompt = getAssistantDefaultSystemPrompt(assistantType);
    let promptTemplateId: string | undefined;
    try {
      const { template, version } = await this.prompts.getActiveVersionByCode(
        getAssistantPromptCode(assistantType),
      );
      promptTemplateId = template.id;
      systemPrompt = version.systemPrompt ?? systemPrompt;
    } catch {
      // No admin-managed prompt exists yet for this assistant type — use the built-in default.
    }

    let citations: KnowledgeSearchResult[] = [];
    if (input.useKnowledge) {
      citations = await this.vectorSearch.search(redactedMessage, {
        sourceIds: input.knowledgeSourceIds,
        topK: 4,
      });
      if (citations.length > 0) {
        const context = citations
          .map((c, i) => `[${i + 1}] (${c.sourceName}) ${c.content}`)
          .join('\n\n');
        systemPrompt = `${systemPrompt}\n\nUse the following knowledge base context when relevant, and cite sources by number:\n${context}`;
      }
    }

    const history = await this.conversations.getRecentMessages(conversation.id, 10);
    const cacheModelKey = input.providerCode ?? 'auto';
    const cacheKey = this.cache.buildKey(`${systemPrompt}\u0000${redactedMessage}`, cacheModelKey);

    let cached = false;
    let content: string;
    let providerCodeUsed: string;
    let model: string;
    let inputTokens: number;
    let outputTokens: number;
    let latencyMs = 0;

    const cachedRaw = this.env.AI_CACHE_TTL_SECONDS > 0 ? await this.cache.get(cacheKey) : null;
    if (cachedRaw) {
      const parsed = JSON.parse(cachedRaw) as CachedChatPayload;
      content = parsed.content;
      providerCodeUsed = parsed.providerCode;
      model = parsed.model;
      inputTokens = parsed.inputTokens;
      outputTokens = parsed.outputTokens;
      cached = true;
    } else {
      const messages: ChatMessageInput[] = [
        { role: 'SYSTEM', content: systemPrompt },
        ...history.map((m) => ({ role: m.role as ChatMessageInput['role'], content: m.content })),
        { role: 'USER', content: redactedMessage },
      ];

      try {
        const { result, providerCode: resolvedCode } = await this.modelRouter.withFailover(
          (provider) => provider.chat({ messages }),
          input.providerCode,
        );
        content = sanitizeOutput(result.content);
        providerCodeUsed = resolvedCode;
        model = result.model;
        inputTokens = result.inputTokens;
        outputTokens = result.outputTokens;
        latencyMs = result.latencyMs;

        if (this.env.AI_CACHE_TTL_SECONDS > 0) {
          const payload: CachedChatPayload = {
            content,
            providerCode: providerCodeUsed,
            model,
            inputTokens,
            outputTokens,
          };
          await this.cache.set(cacheKey, JSON.stringify(payload), this.env.AI_CACHE_TTL_SECONDS);
        }
      } catch (error) {
        await this.recordFailedRequest(
          conversation,
          redactedMessage,
          promptTemplateId,
          input,
          error,
          correlationId,
        );
        throw error;
      }
    }

    const userMessage = await this.conversations.appendMessage(conversation.id, {
      role: 'USER',
      content: redactedMessage,
    });
    const assistantMessage = await this.conversations.appendMessage(conversation.id, {
      role: 'ASSISTANT',
      content,
      tokenCount: outputTokens,
      model,
      providerCode: providerCodeUsed,
      metadata: { citations },
    });

    const providerRow = await this.prisma.aiProvider.findUnique({
      where: { code: providerCodeUsed },
    });
    const costUsdMicros = estimateCostUsdMicros(model, inputTokens, outputTokens);

    const request = await this.prisma.aiRequest.create({
      data: {
        ownerUserId: input.ownerUserId,
        conversationId: conversation.id,
        promptTemplateId,
        providerId: providerRow?.id,
        assistantType,
        status: cached ? 'CACHED' : 'SUCCEEDED',
        model,
        inputText: redactedMessage,
        outputText: content,
        inputTokens,
        outputTokens,
        latencyMs,
        costUsdMicros,
        cacheHit: cached,
        correlationId,
        metadata: { citations } as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    await this.prisma.aiTokenUsage.create({
      data: {
        requestId: request.id,
        ownerUserId: input.ownerUserId,
        providerCode: providerCodeUsed,
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        costUsdMicros,
      },
    });

    if (providerRow) {
      await this.bumpProviderMetric(providerRow.id, {
        success: true,
        cacheHit: cached,
        latencyMs,
        tokens: inputTokens + outputTokens,
        costUsdMicros,
      });
    }

    await this.audit.record('ai.chat.completed', {
      actorUserId: input.ownerUserId,
      resourceType: 'AiConversation',
      resourceId: conversation.id,
      correlationId,
      details: {
        providerCode: providerCodeUsed,
        model,
        cacheHit: cached,
        citationCount: citations.length,
      },
    });

    await this.events.publish({
      type: AiEventType.RequestCompleted,
      aggregateId: request.id,
      correlationId,
      payload: {
        conversationId: conversation.id,
        providerCode: providerCodeUsed,
        cacheHit: cached,
      },
    });
    await this.analytics.publishEvent({
      eventType: 'ai.chat.completed',
      domain: 'AI',
      aggregateId: request.id,
      correlationId,
      ownerUserId: input.ownerUserId,
      metrics: { ai_request_count: 1 },
      payload: {
        conversationId: conversation.id,
        providerCode: providerCodeUsed,
        cacheHit: cached,
      },
    });

    return { conversation, userMessage, assistantMessage, request, cached, citations };
  }

  private async recordFailedRequest(
    conversation: AiConversation,
    inputText: string,
    promptTemplateId: string | undefined,
    input: ChatInput,
    error: unknown,
    correlationId: string,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const request = await this.prisma.aiRequest.create({
      data: {
        ownerUserId: input.ownerUserId,
        conversationId: conversation.id,
        promptTemplateId,
        assistantType: conversation.assistantType,
        status: 'FAILED',
        inputText,
        errorMessage: message,
        correlationId,
      },
    });
    await this.audit.record('ai.chat.failed', {
      actorUserId: input.ownerUserId,
      resourceType: 'AiConversation',
      resourceId: conversation.id,
      correlationId,
      details: { error: message },
    });
    await this.events.publish({
      type: AiEventType.RequestFailed,
      aggregateId: request.id,
      correlationId,
      payload: { error: message },
    });
  }

  private async bumpProviderMetric(
    providerId: string,
    opts: {
      success: boolean;
      cacheHit: boolean;
      latencyMs: number;
      tokens: number;
      costUsdMicros: number;
    },
  ): Promise<void> {
    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    await this.prisma.aiProviderMetric.upsert({
      where: { providerId_windowStart: { providerId, windowStart } },
      create: {
        providerId,
        windowStart,
        requestCount: 1,
        successCount: opts.success ? 1 : 0,
        failureCount: opts.success ? 0 : 1,
        cacheHitCount: opts.cacheHit ? 1 : 0,
        totalLatencyMs: BigInt(Math.max(0, opts.latencyMs)),
        totalTokens: BigInt(Math.max(0, opts.tokens)),
        totalCostMicros: BigInt(Math.max(0, opts.costUsdMicros)),
      },
      update: {
        requestCount: { increment: 1 },
        successCount: { increment: opts.success ? 1 : 0 },
        failureCount: { increment: opts.success ? 0 : 1 },
        cacheHitCount: { increment: opts.cacheHit ? 1 : 0 },
        totalLatencyMs: { increment: BigInt(Math.max(0, opts.latencyMs)) },
        totalTokens: { increment: BigInt(Math.max(0, opts.tokens)) },
        totalCostMicros: { increment: BigInt(Math.max(0, opts.costUsdMicros)) },
      },
    });
  }
}
