/**
 * Idempotent GET/read retries only — never wrap mutating send/sign.
 */

export type GetRetryOptions = {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryIf?: (error: unknown) => boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withGetRetry<T>(
  action: () => Promise<T>,
  options: GetRetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 120;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const retryIf = options.retryIf ?? (() => true);
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !retryIf(error)) throw error;
      const delay = Math.min(initialDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(delay);
    }
  }
  throw lastError;
}

export function isTransientHttpError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('fetch') ||
    msg.includes('503') ||
    msg.includes('502') ||
    msg.includes('429')
  );
}
