'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { env } from '../../env';
import { getStoredAccessToken } from '../api-client';
import type { PermissionGrant, Web3ActivityItem } from './demo';

/** Shared JSON fetch for connections / Web3 gateway routes. */
export async function web3Fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredAccessToken();
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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

/** Basic HTTPS URL validation for the embedded browser address bar. */
export function isSecureDappUrl(
  raw: string,
): { ok: true; url: URL } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'Enter a URL' };
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    if (url.protocol !== 'https:') {
      return { ok: false, reason: 'Only HTTPS origins are allowed' };
    }
    if (!url.hostname || url.hostname === 'localhost') {
      return { ok: false, reason: 'Use a public HTTPS domain' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }
}

export function originFromUrl(raw: string): string {
  const check = isSecureDappUrl(raw);
  if (!check.ok) return raw;
  return check.url.origin;
}

/** Normalize live permission rows into hub PermissionGrant shape. */
export function mapPermissionGrants(raw: unknown): PermissionGrant[] {
  if (!Array.isArray(raw)) return [];
  const out: PermissionGrant[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const r = row as Record<string, unknown>;
    const permission = String(r.permission ?? '');
    const origin = String(r.origin ?? '');
    if (!permission || !origin) return;
    const risk: PermissionGrant['risk'] = permission.includes('TRANSACTION')
      ? 'elevated'
      : permission.includes('SIGNATURE')
        ? 'medium'
        : 'low';
    out.push({
      id: String(r.id ?? `p-${i}`),
      origin,
      account: String(r.account ?? 'Connected account'),
      permission,
      network: String(r.network ?? 'ETHEREUM'),
      lastActivity: String(r.updatedAt ?? r.createdAt ?? new Date().toISOString()),
      risk,
    });
  });
  return out;
}

/** Normalize live activity events into Web3ActivityItem shape. */
export function mapActivityItems(raw: unknown): Web3ActivityItem[] {
  if (!Array.isArray(raw)) return [];
  const out: Web3ActivityItem[] = [];
  raw.forEach((row, i) => {
    if (!row || typeof row !== 'object') return;
    const r = row as Record<string, unknown>;
    const eventType = String(r.eventType ?? r.kind ?? '').toLowerCase();
    let kind: Web3ActivityItem['kind'] = 'connected';
    if (eventType.includes('sign')) kind = 'signature';
    else if (eventType.includes('tx') || eventType.includes('transaction')) kind = 'transaction';
    else if (eventType.includes('permission')) kind = 'permission';
    else if (eventType.includes('network')) kind = 'network';
    else if (eventType.includes('security') || eventType.includes('phish')) kind = 'security';
    else if (eventType.includes('connect')) kind = 'connected';
    out.push({
      id: String(r.id ?? `wa-${i}`),
      kind,
      title: String(r.summary ?? r.title ?? (eventType || 'Web3 event')),
      detail: String(r.detail ?? r.eventType ?? ''),
      origin: r.origin ? String(r.origin) : undefined,
      timestamp: String(r.createdAt ?? r.timestamp ?? new Date().toISOString()),
      status: 'confirmed',
    });
  });
  return out;
}
