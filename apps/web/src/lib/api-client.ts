'use client';

import { AuvoraClient } from '@auvora/sdk';
import { env } from '../env';
import { isTransientHttpError, withGetRetry } from './reliability/get-retry';

export const ACCESS_TOKEN_KEY = 'auvora_access_token';

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  // Prefer sessionStorage (tab-scoped). Migrate legacy localStorage once.
  const session = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (session) return session;
  const legacy = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (legacy) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, legacy);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    return legacy;
  }
  return null;
}

export function setStoredAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  if (token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function createApiClient(options?: { timeoutMs?: number }): AuvoraClient {
  const client = new AuvoraClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    credentials: 'include',
    ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  });
  client.setAccessToken(getStoredAccessToken());
  return client;
}

/** GET-shaped calls with capped retries (idempotent reads only). */
export async function apiGetWithRetry<T>(
  loader: (client: AuvoraClient) => Promise<T>,
  options?: { timeoutMs?: number; maxAttempts?: number },
): Promise<T> {
  const client = createApiClient({ timeoutMs: options?.timeoutMs ?? 12_000 });
  return withGetRetry(() => loader(client), {
    maxAttempts: options?.maxAttempts ?? 3,
    retryIf: isTransientHttpError,
  });
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
