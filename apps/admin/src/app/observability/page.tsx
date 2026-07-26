'use client';

import { AuvoraClientError, type OpsDashboardOverview } from '@auvora/sdk';
import { Alert, EmptyState, LoadingBlock, Skeleton } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminObservabilityPage(): ReactElement {
  const [overview, setOverview] = useState<OpsDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setOverview(await client.adminObservabilityDashboard());
    } catch (err) {
      setOverview(null);
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
      <header className="page__header">
        <h1>Operations</h1>
        <nav className="page__subnav" aria-label="Observability sections">
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

      {loading ? (
        <>
          <LoadingBlock message="Loading operations dashboard…" />
          <Skeleton rows={4} label="Loading operations metrics" />
        </>
      ) : null}

      {error ? (
        <Alert tone="error" title="Could not load operations dashboard">
          {error}
        </Alert>
      ) : null}

      {!loading && !error && overview ? (
        <>
          <div className="metric-grid" aria-label="Operations summary">
            <div className="metric-card">
              <span className="metric-card__label">Open alerts</span>
              <span className="metric-card__value">{overview.openAlertCount}</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Open incidents</span>
              <span className="metric-card__value">{overview.openIncidentCount}</span>
            </div>
            <div className="metric-card">
              <span className="metric-card__label">Unhealthy services</span>
              <span className="metric-card__value">{overview.unhealthyServiceCount}</span>
            </div>
          </div>
          <p className="page-subtitle">Generated {overview.generatedAt}</p>
          {overview.services.length === 0 ? (
            <EmptyState
              title="No service health samples"
              description="Telemetry has not reported service status yet."
            />
          ) : (
            <ul className="stack">
              {overview.services.map((service) => (
                <li key={service.serviceName}>
                  <span
                    className={`dot ${service.status === 'OK' || service.status === 'HEALTHY' ? 'dot--healthy' : 'dot--unhealthy'}`}
                    aria-hidden
                  />
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
