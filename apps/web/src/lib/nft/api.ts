'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { env } from '../../env';
import { getStoredAccessToken } from '../api-client';

/** Shared JSON fetch for NFT gateway routes. */
export async function nftFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function explorerUrl(network: string, contract: string, tokenId?: string): string {
  const n = network.toUpperCase();
  if (n.includes('SOLANA')) {
    return `https://solscan.io/token/${contract}`;
  }
  if (n.includes('POLYGON')) {
    return tokenId
      ? `https://polygonscan.com/token/${contract}?a=${tokenId}`
      : `https://polygonscan.com/token/${contract}`;
  }
  if (n.includes('BNB')) {
    return tokenId
      ? `https://bscscan.com/token/${contract}?a=${tokenId}`
      : `https://bscscan.com/token/${contract}`;
  }
  return tokenId
    ? `https://etherscan.io/token/${contract}?a=${tokenId}`
    : `https://etherscan.io/token/${contract}`;
}
