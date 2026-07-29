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

export interface GeminiHttpConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  timeoutMs?: number;
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

interface GeminiGenerateResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
interface GeminiEmbedResponse {
  embedding?: { values: number[] };
}

/** Thin HTTP adapter for the Google Gemini generateContent / embedContent APIs. */
export class GeminiHttpProvider implements AiProviderPort {
  readonly type: AiProviderTypeCode = 'GEMINI';
  private readonly logger: Logger;

  constructor(
    readonly code: string,
    private readonly config: GeminiHttpConfig,
  ) {
    this.logger = new Logger(`Gemini:${code}`);
  }

  private get fetchImpl(): FetchLike {
    return globalThis.fetch.bind(globalThis) as unknown as FetchLike;
  }

  private get baseUrl(): string {
    return (this.config.baseUrl ?? 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  }

  async chat(request: ChatRequest): Promise<ChatResult> {
    const startedAt = Date.now();
    const model = request.model ?? this.config.defaultModel;
    const systemMessage = request.messages.find((m) => m.role === 'SYSTEM')?.content;
    const conversational = request.messages.filter((m) => m.role !== 'SYSTEM');
    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
            contents: conversational.map((m) => ({
              role: m.role === 'ASSISTANT' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.maxTokens,
            },
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
      const body = (await response.json()) as GeminiGenerateResponse;
      const content = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('');
      return {
        providerCode: this.code,
        model,
        content,
        inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? Math.ceil(content.length / 4),
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
    const model = request.model ?? 'text-embedding-004';
    try {
      const vectors: number[][] = [];
      for (const text of request.input) {
        const response = await this.fetchImpl(
          `${this.baseUrl}/v1beta/models/${model}:embedContent?key=${this.config.apiKey}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ content: { parts: [{ text }] } }),
            signal: AbortSignal.timeout(this.config.timeoutMs ?? 30_000),
          },
        );
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          throw new ProviderUnavailableError(
            `${this.code} HTTP ${response.status}: ${errorText.slice(0, 300)}`,
          );
        }
        const body = (await response.json()) as GeminiEmbedResponse;
        vectors.push(body.embedding?.values ?? []);
      }
      return {
        providerCode: this.code,
        model,
        dimensions: vectors[0]?.length ?? 0,
        vectors,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new ProviderUnavailableError(`${this.code} embeddings request failed: ${message}`);
    }
  }

  async health(): Promise<ProviderHealthResult> {
    return Promise.resolve({ healthy: true, providerCode: this.code, checkedAt: new Date() });
  }
}
