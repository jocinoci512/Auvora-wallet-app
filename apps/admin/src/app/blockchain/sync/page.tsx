'use client';

import {
  AuvoraClientError,
  type ChainNetwork,
  type SyncJob,
  type SyncJobStatus,
  type SyncJobType,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

const CHAINS = [
  'BITCOIN',
  'ETHEREUM',
  'POLYGON',
  'SOLANA',
  'BNB_SMART_CHAIN',
  'TRON',
  'LITECOIN',
] as const satisfies readonly ChainNetwork[];

const JOB_TYPES = [
  'BLOCK_SCAN',
  'ADDRESS_WATCH',
  'MEMPOOL',
  'REORG_CHECK',
  'RETRY',
] as const satisfies readonly SyncJobType[];

const STATUSES: Array<SyncJobStatus | ''> = [
  '',
  'QUEUED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'RETRYING',
  'CANCELLED',
];

function statusClass(status: SyncJob['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

export default function AdminBlockchainSyncPage(): ReactElement {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<SyncJobStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [triggerChain, setTriggerChain] = useState<ChainNetwork>(CHAINS[0]);
  const [triggerType, setTriggerType] = useState<SyncJobType>(JOB_TYPES[0]);
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListSyncJobs({ status: status || undefined });
      setJobs(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleTrigger(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setTriggering(true);
    setTriggerError(null);
    try {
      const client = createApiClient();
      await client.adminTriggerSync({ chain: triggerChain, type: triggerType });
      await load();
    } catch (err) {
      setTriggerError(formatApiError(err));
    } finally {
      setTriggering(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Sync jobs</h1>
          <p className="page-subtitle">
            {total} job{total === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="form-card">
        <h2>Trigger sync</h2>
        <form className="form-inline" onSubmit={(e) => void handleTrigger(e)}>
          <label className="field">
            <span className="field-label">Chain</span>
            <select
              className="field-input"
              value={triggerChain}
              onChange={(e) => setTriggerChain(e.target.value as ChainNetwork)}
            >
              {CHAINS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Job type</span>
            <select
              className="field-input"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as SyncJobType)}
            >
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={triggering}>
            {triggering ? 'Triggering…' : 'Trigger sync'}
          </Button>
        </form>
        {triggerError ? <div className="alert alert--error">{triggerError}</div> : null}
      </section>

      <section className="panel filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as SyncJobStatus | '')}
            >
              {STATUSES.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s || 'All'}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading ? <p className="state-message">Loading sync jobs…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!loading && !error && jobs.length === 0 ? (
        <p className="state-message">No sync jobs match your filters.</p>
      ) : null}

      {!loading && jobs.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th>Type</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Scheduled</th>
              <th>Last error</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>{job.chain.replace(/_/g, ' ')}</td>
                <td>{job.type.replace(/_/g, ' ')}</td>
                <td>
                  <span className={statusClass(job.status)}>{job.status}</span>
                </td>
                <td>
                  {job.attempts}/{job.maxAttempts}
                </td>
                <td>{new Date(job.scheduledAt).toLocaleString()}</td>
                <td>{job.lastError ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
