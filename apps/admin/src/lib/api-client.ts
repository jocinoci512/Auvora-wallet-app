'use client';

import { AuvoraClient } from '@auvora/sdk';
import { env } from '../env';

export const ACCESS_TOKEN_KEY = 'auvora_access_token';
export const ADMIN_CSRF_KEY = 'auvora_admin_csrf';
export const ACCESS_TOKEN_CHANGED_EVENT = 'auvora:access-token-changed';

export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Phase 3 Admin security architecture is frozen. Visual work must not weaken cookie/MFA/RBAC flows. */

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (isProductionBuild()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setStoredAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (isProductionBuild()) return;
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  window.dispatchEvent(new CustomEvent(ACCESS_TOKEN_CHANGED_EVENT));
}

export function getAdminCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ADMIN_CSRF_KEY);
}

export function setAdminCsrfToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    sessionStorage.setItem(ADMIN_CSRF_KEY, token);
  } else {
    sessionStorage.removeItem(ADMIN_CSRF_KEY);
  }
}

export function setAdminUiMarker(present: boolean): void {
  if (typeof document === 'undefined') return;
  if (present) {
    document.cookie = 'auvora_admin_ui=1; Path=/; SameSite=Lax';
  } else {
    document.cookie = 'auvora_admin_ui=; Path=/; Max-Age=0; SameSite=Lax';
  }
}

export function createApiClient(): AuvoraClient {
  const client = new AuvoraClient({
    baseUrl: env.NEXT_PUBLIC_API_URL,
    credentials: 'include',
  });
  if (!isProductionBuild()) {
    client.setAccessToken(getStoredAccessToken());
  }
  client.setCsrfToken(getAdminCsrfToken());
  return client;
}

export function formatApiError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'An unexpected error occurred';
}

export function formatAdminError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return 'Your Admin session expired. Sign in again.';
  if (status === 403) {
    const message = formatApiError(error);
    if (/step-up/i.test(message)) {
      return 'This action needs a recent password and authenticator confirmation.';
    }
    return 'You do not have permission for this action.';
  }
  if (status === 429) return 'Too many requests. Wait a moment and try again.';
  if (status === 502 || status === 503 || status === 504) {
    return 'A dependent service is unavailable. Try again shortly.';
  }
  if (status === 500) return 'The control plane could not complete this request.';
  const message = formatApiError(error);
  if (/request failed with status/i.test(message)) {
    return 'A dependent service is unavailable. Try again shortly.';
  }
  return message;
}

export function isStepUpRequired(error: unknown): boolean {
  return /step-up/i.test(formatApiError(error));
}

export const ADMIN_PUBLIC_PATHS = [
  '/login',
  '/mfa',
  '/mfa/enroll',
  '/recovery',
  '/locked',
  '/forbidden',
  '/session-expired',
  '/suspended',
  '/step-up',
] as const;

export function isAdminPublicPath(pathname: string): boolean {
  return ADMIN_PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
