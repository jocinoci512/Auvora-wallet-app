'use client';

import { env } from '../../env';
import { getStoredAccessToken } from '../api-client';

export type ActivityDataState = 'live' | 'demo' | 'unavailable' | 'empty';

export type LiveActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  createdAt: string;
  network?: string;
};

export type LiveActivityResult = {
  state: ActivityDataState;
  items: LiveActivityItem[];
  message: string;
};

/**
 * Activity for the signed-in account from backend chain/tx records.
 * Does not manufacture history when APIs fail.
 */
export async function loadLiveActivity(): Promise<LiveActivityResult> {
  if (!getStoredAccessToken()) {
    return {
      state: 'demo',
      items: [],
      message: 'Sign in to load activity for registered public addresses.',
    };
  }

  try {
    const response = await fetch(
      `${env.NEXT_PUBLIC_API_URL}/api/v1/blockchain/transactions?take=50`,
      {
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${getStoredAccessToken()}`,
        },
        credentials: 'include',
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok) {
      return {
        state: 'unavailable',
        items: [],
        message: 'Activity API unavailable.',
      };
    }
    const body = (await response.json()) as {
      success?: boolean;
      data?: { items?: unknown[] } | unknown[];
    };
    const rows = Array.isArray(body.data)
      ? body.data
      : Array.isArray((body.data as { items?: unknown[] } | undefined)?.items)
        ? ((body.data as { items: unknown[] }).items ?? [])
        : [];

    const items: LiveActivityItem[] = rows.map((row, i) => {
      const r = (row ?? {}) as Record<string, unknown>;
      return {
        id: String(r.id ?? r.hash ?? `tx-${i}`),
        title: String(r.type ?? r.status ?? 'Transaction'),
        subtitle: String(r.hash ?? r.reference ?? r.toAddress ?? 'On-chain activity'),
        status: String(r.status ?? 'UNKNOWN'),
        createdAt: String(r.createdAt ?? r.confirmedAt ?? new Date().toISOString()),
        network: r.chain ? String(r.chain) : undefined,
      };
    });

    if (!items.length) {
      return {
        state: 'empty',
        items: [],
        message: 'No on-chain activity recorded for this account yet.',
      };
    }

    return {
      state: 'live',
      items,
      message: 'Live activity from registered addresses / account-linked chain records.',
    };
  } catch {
    return {
      state: 'unavailable',
      items: [],
      message: 'Could not load activity. No manufactured history is shown.',
    };
  }
}
