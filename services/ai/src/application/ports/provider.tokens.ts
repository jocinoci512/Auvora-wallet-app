export const MODEL_ROUTER = Symbol('MODEL_ROUTER');
export const REQUEST_CACHE = Symbol('REQUEST_CACHE');

export interface RequestCachePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  buildKey(prompt: string, model: string): string;
}
