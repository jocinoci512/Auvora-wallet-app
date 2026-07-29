import { createHash } from 'node:crypto';
import type {
  AiProviderPort,
  AiProviderTypeCode,
  ChatRequest,
  ChatResult,
  EmbedRequest,
  EmbedResult,
  ProviderHealthResult,
} from '../../domain';

const EMBEDDING_DIMENSIONS = 32;

/** Produces a deterministic pseudo-embedding from repeated SHA-256 hashing, normalized to a unit vector. */
export function hashEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vector: number[] = [];
  let material = text;
  while (vector.length < dimensions) {
    const digest = createHash('sha256').update(material).digest();
    for (let i = 0; i < digest.length && vector.length < dimensions; i += 1) {
      vector.push(((digest[i] ?? 0) - 128) / 128);
    }
    material = digest.toString('hex');
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

/** Deterministic in-memory chat/embedding backend used for local development, tests, and demos. */
export class SimulatorAiProvider implements AiProviderPort {
  readonly type: AiProviderTypeCode = 'SIMULATOR';

  constructor(
    readonly code: string,
    private readonly defaultModel = 'sim-gpt',
  ) {}

  async chat(request: ChatRequest): Promise<ChatResult> {
    const startedAt = Date.now();
    const lastUserMessage = [...request.messages].reverse().find((m) => m.role === 'USER');
    const content = `[simulator] ${lastUserMessage?.content ?? 'Hello from the Auvora AI simulator.'}`;
    const inputTokens = Math.max(
      1,
      Math.ceil(request.messages.reduce((sum, m) => sum + m.content.length, 0) / 4),
    );
    const outputTokens = Math.max(1, Math.ceil(content.length / 4));
    return Promise.resolve({
      providerCode: this.code,
      model: request.model ?? this.defaultModel,
      content,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startedAt,
    });
  }

  async embed(request: EmbedRequest): Promise<EmbedResult> {
    const startedAt = Date.now();
    const vectors = request.input.map((text) => hashEmbedding(text));
    return Promise.resolve({
      providerCode: this.code,
      model: request.model ?? 'sim-embed-v1',
      dimensions: EMBEDDING_DIMENSIONS,
      vectors,
      latencyMs: Date.now() - startedAt,
    });
  }

  async health(): Promise<ProviderHealthResult> {
    return Promise.resolve({
      healthy: true,
      providerCode: this.code,
      checkedAt: new Date(),
      latencyMs: 0,
    });
  }
}
