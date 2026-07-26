import { Logger } from '@nestjs/common';
import type {
  AiProviderPort,
  AiProviderTypeCode,
  ChatMessageInput,
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  ProviderHealthResult,
} from '../../domain';
import { ProviderUnavailableError } from '../../domain';

export interface HttpOpenAiCompatibleConfig {
  /** Base URL up to (but not including) `/chat/completions` or `/embeddings`, e.g. `https://api.openai.com/v1`. */
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
  authHeaderName?: string;
  authHeaderPrefix?: string;
  extraQuery?: string;
  timeoutMs?: number;
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

function toOpenAiRole(role: ChatMessageInput['role']): string {
  return role.toLowerCase();
}

interface OpenAiChatChoice {
  message?: { content?: string };
}
interface OpenAiChatResponse {
  model?: string;
  choices?: OpenAiChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}
interface OpenAiEmbeddingResponse {
  model?: string;
  data?: Array<{ embedding: number[] }>;
}

/** Generic adapter for any OpenAI-compatible chat/embeddings API (OpenAI, Azure OpenAI, self-hosted local LLMs). */
export class HttpOpenAiCompatibleProvider implements AiProviderPort {
  private readonly logger: Logger;

  constructor(
    readonly code: string,
    readonly type: AiProviderTypeCode,
    private readonly config: HttpOpenAiCompatibleConfig,
  ) {
    this.logger = new Logger(`OpenAiCompatible:${code}`);
  }

  private get fetchImpl(): FetchLike {
    return globalThis.fetch as unknown as FetchLike;
  }

  private buildUrl(path: string): string {
    return `${this.config.baseUrl.replace(/\/$/, '')}${path}${this.config.extraQuery ?? ''}`;
  }

  private buildHeaders(): Record<string, string> {
    const headerName = this.config.authHeaderName ?? 'authorization';
    const prefix = this.config.authHeaderPrefix ?? 'Bearer ';
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.apiKey) {
      headers[headerName] = `${prefix}${this.config.apiKey}`;
    }
    return headers;
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const startedAt = Date.now();
    const model = request.model ?? this.config.defaultModel;
    try {
      const response = await this.fetchImpl(this.buildUrl('/chat/completions'), {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({ role: toOpenAiRole(m.role), content: m.content })),
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
      });
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ProviderUnavailableError(`${this.code} HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const body = (await response.json()) as OpenAiChatResponse;
      const content = body.choices?.[0]?.message?.content ?? '';
      return {
        providerCode: this.code,
        model: body.model ?? model,
        content,
        inputTokens: body.usage?.prompt_tokens ?? Math.ceil(JSON.stringify(request.messages).length / 4),
        outputTokens: body.usage?.completion_tokens ?? Math.ceil(content.length / 4),
        latencyMs,
      };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Chat request to ${this.code} failed: ${message}`);
      throw new ProviderUnavailableError(`${this.code} request failed: ${message}`);
    }
  }

  async embed(request: EmbedRequest): Promise<EmbedResult> {
    const startedAt = Date.now();
    const model = request.model ?? this.config.defaultModel;
    try {
      const response = await this.fetchImpl(this.buildUrl('/embeddings'), {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify({ model, input: request.input }),
        signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
      });
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ProviderUnavailableError(`${this.code} HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      const body = (await response.json()) as OpenAiEmbeddingResponse;
      const vectors = (body.data ?? []).map((item) => item.embedding);
      return {
        providerCode: this.code,
        model: body.model ?? model,
        dimensions: vectors[0]?.length ?? 0,
        vectors,
        latencyMs,
      };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderUnavailableError(`${this.code} embeddings request failed: ${message}`);
    }
  }

  async health(): Promise<ProviderHealthResult> {
    return Promise.resolve({
      healthy: true,
      providerCode: this.code,
      checkedAt: new Date(),
      details: `configured: ${this.config.baseUrl}`,
    });
  }
}
