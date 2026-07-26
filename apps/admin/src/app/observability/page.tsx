'use client';

import { AuvoraClientError, type OpsDashboardOverview } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminObservabilityPage(): ReactElement {
  const [overview, setOverview] = useState<OpsDashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setOverview(await client.adminObservabilityDashboard());
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Operations</h1>
        <nav className="page__subnav">
          <Link href="/observability">Dashboard</Link>
          <Link href="/observability/alerts">Alerts</Link>
          <Link href="/observability/incidents">Incidents</Link>
          <Link href="/observability/slos">SLOs</Link>
          <Link href="/observability/capacity">Capacity</Link>
          <Link href="/observability/health">Health</Link>
          <Link href="/observability/dependencies">Dependencies</Link>
          <Link href="/observability/traces">Traces</Link>
          <Link href="/observability/logs">Logs</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {overview ? (
        <>
          <p>
            Generated {overview.generatedAt} · Alerts {overview.openAlertCount} · Incidents{' '}
            {overview.openIncidentCount} · Unhealthy {overview.unhealthyServiceCount}
          </p>
          <ul className="stack">
            {overview.services.map((service) => (
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
