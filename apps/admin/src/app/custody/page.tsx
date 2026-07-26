'use client';

import {
  AuvoraClientError,
  type CustodyDashboardMetrics,
  type CustodyProvider,
  type SigningRequest,
} from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminCustodyPage(): ReactElement {
  const [metrics, setMetrics] = useState<CustodyDashboardMetrics | null>(null);
  const [providers, setProviders] = useState<CustodyProvider[]>([]);
  const [queue, setQueue] = useState<SigningRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const [m, p, q] = await Promise.all([
        client.adminCustodyDashboard(),
        client.adminListCustodyProviders(),
        client.adminCustodySigningQueue(),
      ]);
      setMetrics(m);
      setProviders(p);
      setQueue(q.items);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Custody dashboard</h1>
        <nav className="page__subnav">
          <Link href="/custody">Dashboard</Link>
          <Link href="/custody/keys">Keys</Link>
          <Link href="/custody/signing">Signing queue</Link>
          <Link href="/custody/approvals">Approvals</Link>
          <Link href="/custody/policies">Policies</Link>
          <Link href="/custody/signers">Signer groups</Link>
          <Link href="/custody/audit">Audit</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {metrics ? (
        <section className="stack">
          <p>
            Active keys: {metrics.activeKeys} · Pending signing: {metrics.pendingSigning} · Approvals:{' '}
            {metrics.pendingApprovals} · Recoveries: {metrics.pendingRecovery ?? metrics.openRecoveries ?? 0}{' '}
            · Providers: {metrics.enabledProviders} · Recent violations:{' '}
            {metrics.recentViolations?.length ?? metrics.policyViolations24h ?? 0}
          </p>
        </section>
      ) : null}
      <section className="stack">
        <h2>Providers</h2>
        <ul>
          {providers.map((p) => (
            <li key={p.id}>
              {p.code} · {p.custodyModel} · {p.healthStatus} · {p.isEnabled ? 'on' : 'off'}
            </li>
          ))}
        </ul>
      </section>
      <section className="stack">
        <h2>Signing queue (preview)</h2>
        <ul>
          {queue.slice(0, 8).map((r) => (
            <li key={r.id}>
              {r.status} · {r.amount ?? '—'} {r.asset ?? ''}
            </li>
          ))}
          {!queue.length ? <li>Queue empty.</li> : null}
        </ul>
      </section>
    </main>
  );
}
