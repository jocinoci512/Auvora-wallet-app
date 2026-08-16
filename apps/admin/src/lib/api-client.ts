'use client';

import { AuvoraClient } from '@auvora/sdk';
import { env } from '../env';

export const ACCESS_TOKEN_KEY = 'auvora_access_token';

/** Same-tab notification that the stored token changed (storage event only fires cross-tab). */
export const ACCESS_TOKEN_CHANGED_EVENT = 'auvora:access-token-changed';

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  // Let same-tab listeners (e.g. the realtime hook) react immediately.
  window.dispatchEvent(new CustomEvent(ACCESS_TOKEN_CHANGED_EVENT));
}

export function createApiClient(): AuvoraClient {
  const client = new AuvoraClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    credentials: 'include',
  });
  client.setAccessToken(getStoredAccessToken());
  return client;
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred';
}
