import { Logger } from '@nestjs/common';
import type {
  AiProviderPort,
  AiProviderTypeCode,
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  ProviderHealthResult,
} from '../../domain';
import { ProviderUnavailableError } from '../../domain';

export interface AnthropicHttpConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  apiVersion?: string;
  timeoutMs?: number;
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

interface AnthropicMessageResponse {
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Thin HTTP adapter for the Anthropic Messages API. Anthropic has no public embeddings endpoint. */
export class AnthropicHttpProvider implements AiProviderPort {
  readonly type: AiProviderTypeCode = 'ANTHROPIC';
  private readonly logger: Logger;

  constructor(
    readonly code: string,
    private readonly config: AnthropicHttpConfig,
  ) {
    this.logger = new Logger(`Anthropic:${code}`);
  }

  private get fetchImpl(): FetchLike {
    return globalThis.fetch.bind(globalThis) as unknown as FetchLike;
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const startedAt = Date.now();
    const model = request.model ?? this.config.defaultModel;
    const systemMessage = request.messages.find((m) => m.role === 'SYSTEM')?.content;
    const conversational = request.messages.filter((m) => m.role !== 'SYSTEM');
    try {
      const response = await this.fetchImpl(
        `${(this.config.baseUrl ?? 'https://api.anthropic.com').replace(/\/$/, '')}/v1/messages`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.config.apiVersion ?? '2023-06-01',
          },
          body: JSON.stringify({
            model,
            system: systemMessage,
            max_tokens: request.maxTokens ?? 1024,
            temperature: request.temperature,
            messages: conversational.map((m) => ({
              role: m.role === 'ASSISTANT' ? 'assistant' : 'user',
              content: m.content,
            })),
          }),
          signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
        },
      );
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ProviderUnavailableError(
          `${this.code} HTTP ${response.status}: ${text.slice(0, 300)}`,
        );
      }
      const body = (await response.json()) as AnthropicMessageResponse;
      const content = (body.content ?? []).map((block) => block.text ?? '').join('');
      return {
        providerCode: this.code,
        model: body.model ?? model,
        content,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? Math.ceil(content.length / 4),
        latencyMs,
      };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Chat request to ${this.code} failed: ${message}`);
      throw new ProviderUnavailableError(`${this.code} request failed: ${message}`);
    }
  }

  async embed(_request: EmbedRequest): Promise<EmbedResult> {
    void _request;
    throw new ProviderUnavailableError(`${this.code} does not support embeddings`);
  }

  async health(): Promise<ProviderHealthResult> {
    return Promise.resolve({ healthy: true, providerCode: this.code, checkedAt: new Date() });
  }
}
