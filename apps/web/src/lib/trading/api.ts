'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { env } from '../../env';
import { getStoredAccessToken } from '../api-client';

/** Shared JSON fetch for swap/bridge/staking gateway routes. */
export async function tradingFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function impactPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatSeconds(sec: number): string {
  if (sec < 60) return `~${sec}s`;
  if (sec < 3600) return `~${Math.round(sec / 60)} min`;
  return `~${(sec / 3600).toFixed(1)} h`;
}
