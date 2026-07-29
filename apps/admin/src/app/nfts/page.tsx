'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatApiError, getStoredAccessToken } from '../../lib/api-client';

type Providers = {
  providers: Array<{ code: string; name: string; healthy: boolean; latencyMs: number }>;
};

type MetadataStatus = {
  assets: number;
  media: { ready: number; pending: number; failed: number };
};

type SyncMetrics = {
  recentJobs: number;
  averageSyncDurationMs: number;
  failureCount: number;
};

type Workers = {
  enabled: boolean;
  running: boolean;
  timers: number;
};

export default function AdminNftPage(): ReactElement {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [collections, setCollections] = useState<unknown[]>([]);
  const [metadata, setMetadata] = useState<MetadataStatus | null>(null);
  const [workers, setWorkers] = useState<Workers | null>(null);
  const [sync, setSync] = useState<SyncMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = getStoredAccessToken();
      const headers = {
        accept: 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      };
      const base = process.env.NEXT_PUBLIC_API_URL;
      const [p, c, m, w, s] = await Promise.all([
        fetch(`${base}/api/v1/admin/nfts/providers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/nfts/collections`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/nfts/metadata`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/nfts/workers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/nfts/sync-metrics`, { headers, credentials: 'include' }),
      ]);
      for (const res of [p, c, m, w, s]) {
        if (!res.ok) throw new AuvoraClientError('Admin NFT load failed', res.status);
      }
      setProviders(((await p.json()) as { data: Providers }).data);
      setCollections(((await c.json()) as { data: unknown[] }).data);
      setMetadata(((await m.json()) as { data: MetadataStatus }).data);
      setWorkers(((await w.json()) as { data: Workers }).data);
      setSync(((await s.json()) as { data: SyncMetrics }).data);
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
      <h1>NFT administration</h1>
      <p>Provider dashboard, collections, metadata status, worker health, and sync metrics.</p>
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
        <h2>Collections</h2>
        <p>{collections.length} collections tracked</p>
      </section>

      <section>
        <h2>Metadata status</h2>
        {metadata ? (
          <ul>
            <li>Assets: {metadata.assets}</li>
            <li>Media ready: {metadata.media.ready}</li>
            <li>Media pending: {metadata.media.pending}</li>
            <li>Media failed: {metadata.media.failed}</li>
          </ul>
        ) : (
          <p>No metadata status yet.</p>
        )}
      </section>

      <section>
        <h2>Worker health</h2>
        {workers ? (
          <ul>
            <li>Enabled: {workers.enabled ? 'yes' : 'no'}</li>
            <li>Running: {workers.running ? 'yes' : 'no'}</li>
            <li>Timers: {workers.timers}</li>
          </ul>
        ) : (
          <p>No worker status.</p>
        )}
      </section>

      <section>
        <h2>Synchronization metrics</h2>
        {sync ? (
          <ul>
            <li>Recent jobs: {sync.recentJobs}</li>
            <li>Avg sync duration: {sync.averageSyncDurationMs} ms</li>
            <li>Failures: {sync.failureCount}</li>
          </ul>
        ) : (
          <p>No sync metrics yet.</p>
        )}
      </section>
    </main>
  );
}
