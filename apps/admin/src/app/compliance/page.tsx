'use client';

import {
  AuvoraClientError,
  type ComplianceDashboardMetrics,
  type ComplianceProvider,
  type VerificationRequest,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminCompliancePage(): ReactElement {
  const [metrics, setMetrics] = useState<ComplianceDashboardMetrics | null>(null);
  const [queue, setQueue] = useState<VerificationRequest[]>([]);
  const [providers, setProviders] = useState<ComplianceProvider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const [m, q, p] = await Promise.all([
        client.adminComplianceDashboard(),
        client.adminComplianceKycQueue(),
        client.adminListComplianceProviders(),
      ]);
      setMetrics(m);
      setQueue(q);
      setProviders(p);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve(id: string): Promise<void> {
    setMessage(null);
    try {
      const client = createApiClient();
      await client.adminApproveKyc(id);
      setMessage('Approved');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  async function reject(id: string): Promise<void> {
    setMessage(null);
    try {
      const client = createApiClient();
      await client.adminRejectKyc(id, 'Rejected by admin review');
      setMessage('Rejected');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <main>
      <h1>Compliance admin</h1>
      <p>
        <Link href="/compliance/alerts">AML alerts</Link> · <Link href="/compliance/cases">Cases</Link> ·{' '}
        <Link href="/compliance/rules">Rules</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {metrics ? (
        <section>
          <h2>Dashboard</h2>
          <ul>
            <li>Open alerts: {metrics.openAlerts}</li>
            <li>Open cases: {metrics.openCases}</li>
            <li>Pending KYC: {metrics.pendingKyc}</li>
            <li>Providers: {metrics.enabledProviders}</li>
            <li>Rules: {metrics.enabledRules}</li>
          </ul>
        </section>
      ) : null}
      <section>
        <h2>KYC queue</h2>
        <ul>
          {queue.map((item) => (
            <li key={item.id}>
              {item.ownerUserId.slice(0, 8)}… — {item.requestedLevel} — {item.status}{' '}
              <Button type="button" onClick={() => void approve(item.id)}>
                Approve
              </Button>{' '}
              <Button type="button" onClick={() => void reject(item.id)}>
                Reject
              </Button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2>Providers</h2>
        <ul>
          {providers.map((p) => (
            <li key={p.id}>
              {p.code} ({p.providerType}) — {p.isEnabled ? 'enabled' : 'disabled'}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
