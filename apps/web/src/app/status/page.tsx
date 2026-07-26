'use client';

import { type PlatformStatus } from '@auvora/sdk';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function PlatformStatusPage(): ReactElement {
  const [status, setStatus] = useState<PlatformStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setStatus(await client.getPlatformStatus());
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Platform status</h1>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {status ? (
        <>
          <p>
            Overall: {status.overall} · Updated {status.generatedAt}
          </p>
          <h2>Maintenance</h2>
          <ul className="stack">
            {status.maintenanceNotices.map((notice) => (
              <li key={notice.id}>
                {notice.title}: {notice.message}
              </li>
            ))}
            {!status.maintenanceNotices.length ? <li>No active maintenance notices.</li> : null}
          </ul>
          <h2>Incidents</h2>
          <ul className="stack">
            {status.incidents.map((incident) => (
              <li key={incident.code}>
                {incident.code} [{incident.severity}/{incident.status}] {incident.title}
              </li>
            ))}
            {!status.incidents.length ? <li>No public incidents.</li> : null}
          </ul>
          <h2>Services</h2>
          <ul className="stack">
            {status.services.map((service) => (
              <li key={service.serviceName}>
                {service.serviceName}: {service.status}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
