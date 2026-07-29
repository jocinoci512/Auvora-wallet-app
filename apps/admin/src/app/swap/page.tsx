'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatApiError, getStoredAccessToken } from '../../lib/api-client';

type Providers = {
  providers: Array<{ code: string; name: string; healthy: boolean; latencyMs: number }>;
};
type Analytics = {
  totalSwaps: number;
  successRate: number;
  failureRate: number;
  averagePriceImpactBps: number;
  averageQuoteLatencyMs: number;
};

export default function AdminSwapPage(): ReactElement {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [failures, setFailures] = useState<unknown[]>([]);
  const [routes, setRoutes] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = getStoredAccessToken();
      const headers = {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      };
      const base = process.env.NEXT_PUBLIC_API_URL;
      const [p, a, f, r] = await Promise.all([
        fetch(`${base}/api/v1/admin/swaps/providers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/swaps/analytics`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/swaps/failures`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/swaps/routes`, { headers, credentials: 'include' }),
      ]);
      for (const res of [p, a, f, r]) {
        if (!res.ok) throw new AuvoraClientError('Admin swap load failed', res.status);
      }
      setProviders(((await p.json()) as { data: Providers }).data);
      setAnalytics(((await a.json()) as { data: Analytics }).data);
      setFailures(((await f.json()) as { data: unknown[] }).data);
      setRoutes(((await r.json()) as { data: unknown[] }).data);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <h1>Swap administration</h1>
      <p>Provider health, route monitoring, failure dashboard, and swap analytics.</p>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={() => void load()}>
        Refresh
      </button>

      <section>
        <h2>Provider health</h2>
        <ul>
          {(providers?.providers ?? []).map((p) => (
            <li key={p.code}>
              {p.name} ({p.code}) — {p.healthy ? 'healthy' : 'down'} · {p.latencyMs}ms
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Swap analytics</h2>
        {analytics ? (
          <ul>
            <li>Total swaps: {analytics.totalSwaps}</li>
            <li>Success rate: {(analytics.successRate * 100).toFixed(1)}%</li>
            <li>Failure rate: {(analytics.failureRate * 100).toFixed(1)}%</li>
            <li>Avg price impact: {analytics.averagePriceImpactBps} bps</li>
            <li>Avg quote latency: {analytics.averageQuoteLatencyMs} ms</li>
          </ul>
        ) : (
          <p>No analytics yet.</p>
        )}
      </section>

      <section>
        <h2>Route monitoring</h2>
        <p>{routes.length} recent route snapshots</p>
      </section>

      <section>
        <h2>Failures</h2>
        <p>{failures.length} recent failed executions</p>
      </section>
    </main>
  );
}
