'use client';

import { AuvoraClientError } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatApiError, getStoredAccessToken } from '../../lib/api-client';

type ProviderStatus = {
  activeProvider: string;
  cacheHitRatio: number | null;
  avgProviderLatencyMs: number | null;
  workers?: { enabled: boolean; workers: string[] };
};

export default function AdminMarketDataPage(): ReactElement {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = getStoredAccessToken();
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/admin/market-data/providers`,
        {
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            accept: 'application/json',
          },
          credentials: 'include',
        },
      );
      if (!response.ok) {
        throw new AuvoraClientError('Failed to load market providers', response.status);
      }
      const body = (await response.json()) as { data: ProviderStatus };
      setStatus(body.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Your Admin session expired. Sign in again.'
          : formatApiError(err),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Market data</h1>
        <nav className="page__subnav">
          <Link href="/market">Providers</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {status ? (
        <ul className="stack">
          <li>Provider: {status.activeProvider}</li>
          <li>
            Cache hit ratio:{' '}
            {status.cacheHitRatio != null ? status.cacheHitRatio.toFixed(2) : 'n/a'}
          </li>
          <li>
            Avg provider latency:{' '}
            {status.avgProviderLatencyMs != null
              ? `${status.avgProviderLatencyMs.toFixed(1)} ms`
              : 'n/a'}
          </li>
          <li>
            Workers:{' '}
            {status.workers?.enabled ? status.workers.workers.join(', ') || 'enabled' : 'disabled'}
          </li>
        </ul>
      ) : null}
    </main>
  );
}
