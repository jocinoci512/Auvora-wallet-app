'use client';

import { AuvoraClient } from '@auvora/sdk';
import { env } from '../env';
import { isTransientHttpError, withGetRetry } from './reliability/get-retry';

export const ACCESS_TOKEN_KEY = 'auvora_access_token';
const CSRF_KEY = 'auvora_csrf_token_v1';

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

function readCsrfHint(): string | null {
  if (typeof window === 'undefined') return null;
  const fromSession = sessionStorage.getItem(CSRF_KEY);
  if (fromSession) return fromSession;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function createApiClient(options?: { timeoutMs?: number }): AuvoraClient {
  const client = new AuvoraClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    credentials: 'include',
    ...(options?.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
  });
  client.setAccessToken(getStoredAccessToken());
  const csrf = readCsrfHint();
  if (csrf) client.setCsrfToken(csrf);
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
    const msg = error.message.trim() || 'Request failed';
    if (/429|rate.?limit|too many/i.test(msg)) {
      return 'Too many attempts. Wait a minute and try again.';
    }
    if (/csrf/i.test(msg)) {
      return 'Security check failed. Refresh the page and try again.';
    }
    if (/failed to fetch|networkerror|econnrefused|load failed/i.test(msg)) {
      return 'Cannot reach API. Confirm gateway is running at NEXT_PUBLIC_API_URL.';
    }
    return msg;
  }
  return 'An unexpected error occurred';
}
