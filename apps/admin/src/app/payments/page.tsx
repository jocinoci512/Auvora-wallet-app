'use client';

import {
  AuvoraClientError,
  type PaymentMetrics,
  type PaymentProvider,
  type PaymentProviderHealth,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminPaymentsDashboardPage(): ReactElement {
  const [metrics, setMetrics] = useState<PaymentMetrics | null>(null);
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [health, setHealth] = useState<PaymentProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [m, p, h] = await Promise.all([
        client.adminPaymentMetrics(),
        client.adminListPaymentProviders(),
        client.adminPaymentHealth(),
      ]);
      setMetrics(m);
      setProviders(p);
      setHealth(h);
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

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Payments</h1>
          <p className="page-subtitle">Orchestration dashboard, providers, and settlement health</p>
        </div>
      </header>

      <nav className="subnav" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Link href="/payments/search">Search</Link>
        <Link href="/payments/settlements">Settlements</Link>
        <Link href="/payments/providers">Providers</Link>
        <Link href="/payments/refunds">Refunds</Link>
        <Link href="/payments/disputes">Disputes</Link>
        <Link href="/payments/chargebacks">Chargebacks</Link>
        <Link href="/payments/limits">Limits</Link>
        <Link href="/payments/reconciliation">Reconciliation</Link>
      </nav>

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
            <span className="metric-card__label">Total</span>
            <span className="metric-card__value">{metrics.totalPayments}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Pending</span>
            <span className="metric-card__value">{metrics.pendingPayments}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Completed</span>
            <span className="metric-card__value">{metrics.completedPayments}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Failed</span>
            <span className="metric-card__value">{metrics.failedPayments}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Open disputes</span>
            <span className="metric-card__value">{metrics.openDisputes}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Recon pending</span>
            <span className="metric-card__value">{metrics.pendingReconciliation}</span>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>Providers ({providers.length})</h2>
          <ul>
            {providers.map((provider) => {
              const latest = health.find((item) => item.providerCode === provider.code);
              return (
                <li key={provider.id}>
                  {provider.name} ({provider.code}) — {provider.isEnabled ? 'enabled' : 'disabled'}
                  {latest ? ` — health ${latest.status}` : ''}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
