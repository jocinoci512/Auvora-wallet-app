'use client';

import { type PlatformStatus } from '@auvora/sdk';
import { Alert, EmptyState, LoadingBlock, Skeleton } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function PlatformStatusPage(): ReactElement {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setStatus(await client.getPlatformStatus());
    } catch (err) {
      setStatus(null);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Platform status</h1>
        <p className="page-subtitle">Public maintenance, incidents, and service health.</p>
      </header>

      {loading ? (
        <>
          <LoadingBlock message="Loading platform status…" />
          <Skeleton rows={4} label="Loading status" />
        </>
      ) : null}

      {error ? (
        <Alert tone="error" title="Could not load status">
          {error}
        </Alert>
      ) : null}

      {!loading && status ? (
        <>
          <p>
            Overall: <strong>{status.overall}</strong> · Updated {status.generatedAt}
          </p>
          <h2>Maintenance</h2>
          {status.maintenanceNotices.length === 0 ? (
            <EmptyState
              title="No active maintenance"
              description="There are no scheduled notices right now."
            />
          ) : (
            <ul className="stack">
              {status.maintenanceNotices.map((notice) => (
                <li key={notice.id}>
                  {notice.title}: {notice.message}
                </li>
              ))}
            </ul>
          )}
          <h2>Incidents</h2>
          {status.incidents.length === 0 ? (
            <EmptyState
              title="No public incidents"
              description="No open incidents are published."
            />
          ) : (
            <ul className="stack">
              {status.incidents.map((incident) => (
                <li key={incident.code}>
                  {incident.code} [{incident.severity}/{incident.status}] {incident.title}
                </li>
              ))}
            </ul>
          )}
          <h2>Services</h2>
          {status.services.length === 0 ? (
            <EmptyState
              title="No service samples"
              description="Health samples have not arrived yet."
            />
          ) : (
            <ul className="stack">
              {status.services.map((service) => (
                <li key={service.serviceName}>
                  {service.serviceName}: {service.status}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </main>
  );
}
