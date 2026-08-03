'use client';

import { createApiClient, getStoredAccessToken, setStoredAccessToken } from '../api-client';
import type { UserProfile } from '@auvora/sdk';
import { getOrCreateDeviceId, guessDeviceName } from './device';

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string | null;
  emailVerified?: boolean;
};

const USER_CACHE_KEY = 'auvora_auth_user_v1';
const CSRF_KEY = 'auvora_csrf_token_v1';

export function getCachedUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setCachedUser(user: AuthUser | null): void {
  if (typeof window === 'undefined') return;
  if (!user) {
    sessionStorage.removeItem(USER_CACHE_KEY);
    return;
  }
  sessionStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
}

export function getStoredCsrfToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(CSRF_KEY);
}

export function setStoredCsrfToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (!token) sessionStorage.removeItem(CSRF_KEY);
  else sessionStorage.setItem(CSRF_KEY, token);
}

export function isSignedIn(): boolean {
  return Boolean(getStoredAccessToken());
}

function toAuthUser(me: UserProfile): AuthUser {
  const name = [me.firstName, me.lastName].filter(Boolean).join(' ').trim();
  return {
    id: me.id,
    email: me.email,
    displayName: name || me.username || null,
    emailVerified: me.emailVerified,
  };
}

function usernameFromEmail(email: string): string {
  const base = email.split('@')[0]?.replace(/[^a-zA-Z0-9_]/g, '_') || 'auvora';
  return base.slice(0, 24) || 'auvora';
}

function applyClientTokens(client: ReturnType<typeof createApiClient>, csrf?: string | null): void {
  if (csrf) {
    setStoredCsrfToken(csrf);
    client.setCsrfToken(csrf);
  } else {
    const stored = getStoredCsrfToken();
    if (stored) client.setCsrfToken(stored);
  }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const client = createApiClient({ timeoutMs: 15_000 });
  const tokens = await client.login({
    email,
    password,
    deviceFingerprint: getOrCreateDeviceId(),
    deviceName: guessDeviceName(),
    devicePlatform: 'web',
    appVersion: 'web-alpha',
  });
  setStoredAccessToken(tokens.accessToken);
  applyClientTokens(client, tokens.csrfToken);
  const me = await client.getMe();
  const user = toAuthUser(me);
  setCachedUser(user);
  return user;
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<{ userId: string; message: string }> {
  const client = createApiClient({ timeoutMs: 15_000 });
  const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
  return client.register({
    email,
    password,
    username: usernameFromEmail(email),
    ...(parts[0] ? { firstName: parts[0] } : {}),
    ...(parts[1] ? { lastName: parts.slice(1).join(' ') } : {}),
  });
}

export async function refreshSession(): Promise<boolean> {
  try {
    const client = createApiClient({ timeoutMs: 12_000 });
    applyClientTokens(client);
    const tokens = await client.refresh();
    setStoredAccessToken(tokens.accessToken);
    applyClientTokens(client, tokens.csrfToken);
    const me = await client.getMe();
    setCachedUser(toAuthUser(me));
    return true;
  } catch {
    return false;
  }
}

export async function signOut(): Promise<void> {
  try {
    const client = createApiClient({ timeoutMs: 8_000 });
    applyClientTokens(client);
    await client.logout();
  } catch {
    /* clear local anyway */
  }
  setStoredAccessToken(null);
  setStoredCsrfToken(null);
  setCachedUser(null);
}

export async function loadMe(): Promise<AuthUser | null> {
  if (!getStoredAccessToken()) {
    setCachedUser(null);
    return null;
  }
  try {
    const client = createApiClient({ timeoutMs: 10_000 });
    applyClientTokens(client);
    const me = await client.getMe();
    const user = toAuthUser(me);
    setCachedUser(user);
    return user;
  } catch {
    const refreshed = await refreshSession();
    if (refreshed) return getCachedUser();
    return getCachedUser();
  }
}

export async function forgotPassword(email: string): Promise<string> {
  const client = createApiClient({ timeoutMs: 12_000 });
  const res = await client.forgotPassword(email);
  return res.message;
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const client = createApiClient({ timeoutMs: 12_000 });
  const res = await client.resetPassword(token, newPassword);
  return res.message;
}

export async function verifyEmail(token: string): Promise<string> {
  const client = createApiClient({ timeoutMs: 12_000 });
  const res = await client.verifyEmail(token);
  return res.message;
}

export async function resendVerification(email: string): Promise<string> {
  const client = createApiClient({ timeoutMs: 12_000 });
  const res = await client.resendVerification(email);
  return res.message;
}
