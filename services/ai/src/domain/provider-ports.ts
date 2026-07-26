export type AiProviderTypeCode = 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'AZURE_OPENAI' | 'LOCAL' | 'SIMULATOR';

export const ALL_AI_PROVIDER_TYPES: AiProviderTypeCode[] = [
  'OPENAI',
  'ANTHROPIC',
  'GEMINI',
  'AZURE_OPENAI',
  'LOCAL',
  'SIMULATOR',
];

export interface ChatMessageInput {
  role: 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';
  content: string;
}

export interface ChatRequest {
  model?: string;
  messages: ChatMessageInput[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResult {
  providerCode: string;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface EmbedRequest {
  model?: string;
  input: string[];
}

export interface EmbedResult {
  providerCode: string;
  model: string;
  dimensions: number;
  vectors: number[][];
  latencyMs: number;
}

export interface ProviderHealthResult {
  healthy: boolean;
  providerCode: string;
  checkedAt: Date;
  latencyMs?: number;
  details?: string;
}

/** Strategy interface implemented by each LLM backend (simulator, real OpenAI-compatible/Anthropic/Gemini HTTP, etc). */
export interface AiProviderPort {
  code: string;
  type: AiProviderTypeCode;
  chat(request: ChatRequest): Promise<ChatResult>;
  embed(request: EmbedRequest): Promise<EmbedResult>;
  health(): Promise<ProviderHealthResult>;
}

/**
 * Resolves the concrete provider backend at request time, with priority ordering and
 * failover: `resolve` returns the highest-priority enabled+available provider, and
 * `resolveWithFailover` retries the next enabled provider if the first fails.
 */
export interface ModelRouterPort {
  resolve(explicitProviderCode?: string): Promise<AiProviderPort>;
  resolveWithFailover<T>(
    fn: (provider: AiProviderPort) => Promise<T>,
    explicitProviderCode?: string,
  ): Promise<{ result: T; providerCode: string }>;
  listAll(): Promise<AiProviderPort[]>;
}
