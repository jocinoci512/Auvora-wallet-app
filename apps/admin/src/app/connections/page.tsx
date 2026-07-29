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

type Sessions = {
  active: number;
  pending: number;
  terminated: number;
  dappPendingRequests?: number;
  trustedDapps?: number;
};

type DappAnalytics = {
  requestsByStatus: Array<{ status: string; count: number }>;
  activePermissionGrants: number;
  browserBookmarks: number;
  recentActivity: Array<{ id: string; eventType: string; summary: string; origin?: string }>;
};

export default function AdminConnectionsPage(): ReactElement {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [connections, setConnections] = useState<unknown[]>([]);
  const [sessions, setSessions] = useState<Sessions | null>(null);
  const [devices, setDevices] = useState<unknown[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [workers, setWorkers] = useState<Workers | null>(null);
  const [dappAnalytics, setDappAnalytics] = useState<DappAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = getStoredAccessToken();
      const headers = {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      };
      const base = process.env.NEXT_PUBLIC_API_URL;
      const [p, c, s, d, sy, w, da] = await Promise.all([
        fetch(`${base}/api/v1/admin/connections/providers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/connections`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/sessions`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/devices`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/sync-status`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/workers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/connections/dapps/analytics`, {
          headers,
          credentials: 'include',
        }),
      ]);
      for (const res of [p, c, s, d, sy, w, da]) {
        if (!res.ok) {
          throw new AuvoraClientError(await res.text(), res.status);
        }
      }
      setProviders(((await p.json()) as { data: Providers }).data);
      setConnections(((await c.json()) as { data: unknown[] }).data);
      setSessions(((await s.json()) as { data: Sessions }).data);
      setDevices(((await d.json()) as { data: unknown[] }).data);
      setSync(((await sy.json()) as { data: SyncStatus }).data);
      setWorkers(((await w.json()) as { data: Workers }).data);
      setDappAnalytics(((await da.json()) as { data: DappAnalytics }).data);
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
      <h1>Connections administration</h1>
      <p>
        Connection dashboard, session dashboard, permission analytics, provider health, and worker
        monitoring.
      </p>
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
        <h2>Connection dashboard</h2>
        <p>{connections.length} connections tracked</p>
      </section>

      <section>
        <h2>Session dashboard</h2>
        {sessions ? (
          <ul>
            <li>Active: {sessions.active}</li>
            <li>Pending: {sessions.pending}</li>
            <li>Terminated: {sessions.terminated}</li>
            <li>Pending dApp requests: {sessions.dappPendingRequests ?? 0}</li>
            <li>Trusted dApps: {sessions.trustedDapps ?? 0}</li>
          </ul>
        ) : (
          <p>No session metrics yet.</p>
        )}
      </section>

      <section>
        <h2>Permission analytics</h2>
        {dappAnalytics ? (
          <>
            <ul>
              <li>Active permission grants: {dappAnalytics.activePermissionGrants}</li>
              <li>Browser bookmarks: {dappAnalytics.browserBookmarks}</li>
              {dappAnalytics.requestsByStatus.map((r) => (
                <li key={r.status}>
                  Requests {r.status}: {r.count}
                </li>
              ))}
            </ul>
            <h3>Recent dApp activity</h3>
            <ul>
              {dappAnalytics.recentActivity.map((a) => (
                <li key={a.id}>
                  {a.summary} · {a.eventType}
                  {a.origin ? ` · ${a.origin}` : ''}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No permission analytics yet.</p>
        )}
      </section>

      <section>
        <h2>Device metrics</h2>
        <p>{devices.length} hardware devices</p>
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
