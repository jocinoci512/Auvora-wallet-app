'use client';

import { AuvoraClientError, type OpsAlert } from '@auvora/sdk';
import { Alert, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { IDENTITY_LINKS } from '../../lib/section-nav';

export default function SecurityCenterPage(): ReactElement {
  const [alerts, setAlerts] = useState<OpsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListObservabilityAlerts();
      setAlerts(
        result.items.filter(
          (a) =>
            /security|auth|fraud|breach/i.test(`${a.code} ${a.title} ${a.message}`) ||
            a.severity === 'critical' ||
            a.severity === 'CRITICAL',
        ),
      );
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <PageHeader
        title="Security center"
        subtitle="Filtered ops alerts plus links to audit and account controls — not a full SIEM."
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <Alert tone="info" title="Scope">
        This view shows critical and security-keyword observability alerts. It is a triage shortcut,
        not a complete security information platform. Use Audit logs for immutable admin actions and
        Ops → Alerts for the full alert stream.
      </Alert>

      <p className="action-row" style={{ margin: '1rem 0' }}>
        <Link href="/security/audit">
          <Button>Audit logs</Button>
        </Link>
        <Link href="/users">
          <Button variant="secondary">Admin accounts</Button>
        </Link>
        <Link href="/observability/alerts">
          <Button variant="ghost">All ops alerts</Button>
        </Link>
        <Link href="/compliance/alerts">
          <Button variant="ghost">Compliance alerts</Button>
        </Link>
      </p>

      <h2>Security-relevant alerts</h2>
      <AsyncStates
        loading={loading}
        loadingMessage="Loading security alerts…"
        error={error}
        errorTitle="Could not load alerts"
        onRetry={() => void load()}
        empty={!loading && !error && alerts.length === 0}
        emptyTitle="No security-tagged alerts"
        emptyDescription="Critical or security-keyword alerts will appear here when fired."
      >
        <ul className="stack">
          {alerts.map((alert) => (
            <li key={alert.id}>
              <StatusBadge status={alert.severity} /> <StatusBadge status={alert.status} />{' '}
              {alert.title}
              <p className="page-subtitle" style={{ marginTop: '0.35rem' }}>
                {alert.message}
              </p>
            </li>
          ))}
        </ul>
      </AsyncStates>
    </main>
  );
}
