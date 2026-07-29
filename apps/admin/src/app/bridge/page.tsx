'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatApiError, getStoredAccessToken } from '../../lib/api-client';

type Providers = {
  providers: Array<{ code: string; name: string; healthy: boolean; latencyMs: number }>;
};

type Workers = {
  enabled: boolean;
  running: boolean;
  timers: number;
};

type SyncStatus = {
  recentJobs: number;
  averageDurationMs: number;
  failureCount: number;
};

type Failures = {
  failed: number;
  completed: number;
  failureRate: number;
  successRate: number;
};

export default function AdminBridgePage(): ReactElement {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [routes, setRoutes] = useState<unknown[]>([]);
  const [failures, setFailures] = useState<Failures | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [workers, setWorkers] = useState<Workers | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = getStoredAccessToken();
      const headers = {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      };
      const base = process.env.NEXT_PUBLIC_API_URL;
      const [p, r, f, s, w] = await Promise.all([
        fetch(`${base}/api/v1/admin/bridge/providers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/bridge/routes`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/bridge/failures`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/bridge/sync-status`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/bridge/workers`, { headers, credentials: 'include' }),
      ]);
      for (const res of [p, r, f, s, w]) {
        if (!res.ok) throw new AuvoraClientError('Admin bridge load failed', res.status);
      }
      setProviders(((await p.json()) as { data: Providers }).data);
      setRoutes(((await r.json()) as { data: unknown[] }).data);
      setFailures(((await f.json()) as { data: Failures }).data);
      setSync(((await s.json()) as { data: SyncStatus }).data);
      setWorkers(((await w.json()) as { data: Workers }).data);
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
      <h1>Bridge administration</h1>
      <p>Provider health, routes, failure analytics, and worker monitoring.</p>
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={() => void load()}>
        Refresh
      </button>

      <section>
        <h2>Provider dashboard</h2>
        <ul>
          {(providers?.providers ?? []).map((p) => (
            <li key={p.code}>
              {p.name} ({p.code}) — {p.healthy ? 'healthy' : 'down'} · {p.latencyMs}ms
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Route dashboard</h2>
        <p>{routes.length} catalogued routes</p>
      </section>

      <section>
        <h2>Failure analytics</h2>
        {failures ? (
          <ul>
            <li>Completed: {failures.completed}</li>
            <li>Failed: {failures.failed}</li>
            <li>Success rate: {(failures.successRate * 100).toFixed(1)}%</li>
            <li>Failure rate: {(failures.failureRate * 100).toFixed(1)}%</li>
          </ul>
        ) : (
          <p>No analytics yet.</p>
        )}
      </section>

      <section>
        <h2>Synchronization status</h2>
        {sync ? (
          <ul>
            <li>Recent jobs: {sync.recentJobs}</li>
            <li>Avg duration: {sync.averageDurationMs} ms</li>
            <li>Failures: {sync.failureCount}</li>
          </ul>
        ) : (
          <p>No sync status.</p>
        )}
      </section>

      <section>
        <h2>Worker monitoring</h2>
        {workers ? (
          <ul>
            <li>Enabled: {String(workers.enabled)}</li>
            <li>Running: {String(workers.running)}</li>
            <li>Timers: {workers.timers}</li>
          </ul>
        ) : (
          <p>No worker status.</p>
        )}
      </section>
    </main>
  );
}
