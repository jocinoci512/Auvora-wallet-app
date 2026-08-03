'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { env } from '../../env';
import { getStoredAccessToken } from '../api-client';
import type { DemoDevice, DemoSession } from './demo';

function readCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const fromSession = sessionStorage.getItem('auvora_csrf_token_v1');
    if (fromSession) return fromSession;
  } catch {
    /* ignore */
  }
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

/** Shared JSON fetch for auth `/me` and related settings gateway routes. */
export async function settingsFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAccessToken();
  const method = (init?.method ?? 'GET').toUpperCase();
  const mutating = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
  const csrf = mutating ? readCsrfToken() : null;
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...(init?.headers ?? {}),
    },
    credentials: 'include',
    signal: init?.signal ?? AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new AuvoraClientError(await response.text(), response.status);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new AuvoraClientError('Invalid JSON response', response.status);
  }
  if (
    typeof body !== 'object' ||
    body === null ||
    !('data' in body) ||
    (body as { data: unknown }).data === undefined
  ) {
    throw new AuvoraClientError('Missing response data', response.status);
  }
  return (body as { data: T }).data;
}

function guessPlatform(ua: string): string {
  if (/windows/i.test(ua)) return 'Windows';
  if (/mac os|macintosh/i.test(ua)) return 'macOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ios/i.test(ua)) return 'iOS';
  if (/linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function guessBrowser(ua: string): string {
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome\//i.test(ua)) return 'Chrome';
  if (/safari\//i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/firefox\//i.test(ua)) return 'Firefox';
  return ua ? 'Browser' : '—';
}

/** Map auth session rows into settings DemoSession shape. */
export function mapSessions(raw: unknown): DemoSession[] {
  if (!Array.isArray(raw)) return [];
  const out: DemoSession[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const r = row as Record<string, unknown>;
    if (r.revokedAt) return;
    const ua = String(r.userAgent ?? '');
    const active = r.active !== false;
    out.push({
      id: String(r.id ?? `s-${i}`),
      current: i === 0 && active,
      deviceLabel: ua ? ua.slice(0, 48) : 'Session',
      platform: guessPlatform(ua),
      browser: guessBrowser(ua),
      location: r.ipAddress ? `Approximate · ${String(r.ipAddress)}` : 'Approximate · Unknown',
      lastActive: String(r.createdAt ?? new Date().toISOString()),
      expiresAt: String(r.expiresAt ?? new Date().toISOString()),
    });
  });
  if (out.length) out[0]!.current = true;
  return out;
}

/** Map auth device rows into settings DemoDevice shape. */
export function mapDevices(raw: unknown): DemoDevice[] {
  if (!Array.isArray(raw)) return [];
  const out: DemoDevice[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const r = row as Record<string, unknown>;
    if (r.revokedAt) return;
    const ua = String(r.userAgent ?? '');
    out.push({
      id: String(r.id ?? `d-${i}`),
      label: String(r.name ?? 'Device'),
      trusted: Boolean(r.trusted),
      current: i === 0,
      platform: String(r.platform ?? guessPlatform(ua)),
      browser: r.appVersion ? `v${String(r.appVersion)}` : guessBrowser(ua),
      lastLogin: String(r.lastSeenAt ?? r.createdAt ?? new Date().toISOString()),
      location: 'Approximate · Unknown',
    });
  });
  if (out.length) out[0]!.current = true;
  return out;
}
