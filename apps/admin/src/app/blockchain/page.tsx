'use client';

import {
  AuvoraClientError,
  type BlockchainMetrics,
  type ProviderHealthSnapshot,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

function latestByChain(snapshots: ProviderHealthSnapshot[]): ProviderHealthSnapshot[] {
  const byChain = new Map<string, ProviderHealthSnapshot>();
  for (const snapshot of snapshots) {
    const existing = byChain.get(snapshot.chain);
    if (!existing || new Date(snapshot.checkedAt) > new Date(existing.checkedAt)) {
      byChain.set(snapshot.chain, snapshot);
    }
  }
  return Array.from(byChain.values());
}

export default function AdminBlockchainDashboardPage(): ReactElement {
  const [metrics, setMetrics] = useState<BlockchainMetrics | null>(null);
  const [health, setHealth] = useState<ProviderHealthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [metricsData, healthData] = await Promise.all([
        client.adminBlockchainMetrics(),
        client.adminBlockchainHealth(),
      ]);
      setMetrics(metricsData);
      setHealth(healthData);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const perChainHealth = latestByChain(health);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Blockchain</h1>
          <p className="page-subtitle">Provider health, sync activity, and network metrics</p>
        </div>
      </header>

      {loading ? <p className="state-message">Loading dashboard…</p> : null}

      {error ? (
        <div className="alert alert--error">
          {error}
          <Button type="button" variant="secondary" onClick={() => void load()} style={{ marginTop: '0.75rem' }}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error && metrics ? (
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-card__label">Addresses</span>
            <span className="metric-card__value">{metrics.totalAddresses}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Transactions</span>
            <span className="metric-card__value">{metrics.totalTransactions}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Pending transactions</span>
            <span className="metric-card__value">{metrics.pendingTransactions}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Failed transactions</span>
            <span className="metric-card__value">{metrics.failedTransactions}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Active sync jobs</span>
            <span className="metric-card__value">{metrics.activeSyncJobs}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Providers healthy</span>
            <span className="metric-card__value">
              {metrics.healthyProviders}/{metrics.totalProviders}
            </span>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <section className="panel">
          <div className="section-header">
            <h2>Provider health by chain</h2>
            <Link href="/blockchain/providers">View providers</Link>
          </div>
          {perChainHealth.length === 0 ? (
            <p className="state-message">No health snapshots recorded yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Chain</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Block height</th>
                  <th>Checked</th>
                </tr>
              </thead>
              <tbody>
                {perChainHealth.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td>{snapshot.chain.replace(/_/g, ' ')}</td>
                    <td>
                      <span
                        className={`dot ${snapshot.status === 'HEALTHY' || snapshot.status === 'ok' ? 'dot--healthy' : 'dot--unhealthy'}`}
                      />
                      {snapshot.status}
                    </td>
                    <td>{snapshot.latencyMs !== null ? `${snapshot.latencyMs}ms` : '—'}</td>
                    <td>{snapshot.blockHeight ?? '—'}</td>
                    <td>{new Date(snapshot.checkedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      <section className="panel">
        <h2>Quick links</h2>
        <div className="action-row">
          <Link href="/blockchain/providers">
            <Button variant="secondary">Providers</Button>
          </Link>
          <Link href="/blockchain/sync">
            <Button variant="secondary">Sync jobs</Button>
          </Link>
          <Link href="/blockchain/blocks">
            <Button variant="secondary">Blocks</Button>
          </Link>
          <Link href="/blockchain/transactions">
            <Button variant="secondary">Transactions</Button>
          </Link>
          <Link href="/blockchain/addresses">
            <Button variant="secondary">Addresses</Button>
          </Link>
          <Link href="/blockchain/events">
            <Button variant="secondary">Events</Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
