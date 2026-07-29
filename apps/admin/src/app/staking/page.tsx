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

type Rewards = {
  claimedRewards: number;
  claimableRewards: number;
  activePositions: number;
};

export default function AdminStakingPage(): ReactElement {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [validators, setValidators] = useState<unknown[]>([]);
  const [rewards, setRewards] = useState<Rewards | null>(null);
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
      const [p, v, r, s, w] = await Promise.all([
        fetch(`${base}/api/v1/admin/staking/providers`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/staking/validators`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/staking/rewards`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/staking/sync-status`, { headers, credentials: 'include' }),
        fetch(`${base}/api/v1/admin/staking/workers`, { headers, credentials: 'include' }),
      ]);
      for (const res of [p, v, r, s, w]) {
        if (!res.ok) throw new AuvoraClientError('Admin staking load failed', res.status);
      }
      setProviders(((await p.json()) as { data: Providers }).data);
      setValidators(((await v.json()) as { data: unknown[] }).data);
      setRewards(((await r.json()) as { data: Rewards }).data);
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
      <h1>Staking administration</h1>
      <p>Provider health, validators, rewards, sync status, and worker monitoring.</p>
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
        <h2>Validator dashboard</h2>
        <p>{validators.length} validators tracked</p>
      </section>

      <section>
        <h2>Reward monitoring</h2>
        {rewards ? (
          <ul>
            <li>Claimed: {rewards.claimedRewards}</li>
            <li>Claimable: {rewards.claimableRewards}</li>
            <li>Active positions: {rewards.activePositions}</li>
          </ul>
        ) : (
          <p>No reward metrics yet.</p>
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
    </main>
  );
}
