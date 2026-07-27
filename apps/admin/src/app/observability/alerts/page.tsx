'use client';

import { AuvoraClientError, type OpsAlert } from '@auvora/sdk';
import { AsyncStates, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAlertsPage(): ReactElement {
  const [items, setItems] = useState<OpsAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListObservabilityAlerts();
      setItems(result.items);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
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
      <PageHeader title="Alert Center" subtitle="Open and recent platform alerts.">
        <Subnav
          label="Observability sections"
          links={[
            { href: '/observability', label: 'Dashboard' },
            { href: '/observability/alerts', label: 'Alerts' },
            { href: '/observability/incidents', label: 'Incidents' },
          ]}
        />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading alerts…"
        error={error}
        errorTitle="Could not load alerts"
        onRetry={() => void load()}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No alerts"
        emptyDescription="The alert center is quiet — no open or recent alerts."
      >
        <ul className="stack">
          {items.map((alert) => (
            <li key={alert.id}>
              <StatusBadge status={alert.severity} />{' '}
              <StatusBadge status={alert.status} /> {alert.title}
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
