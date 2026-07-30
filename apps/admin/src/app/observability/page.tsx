'use client';

import { AuvoraClientError, type OpsDashboardOverview } from '@auvora/sdk';
import { Alert, EmptyState, LoadingBlock, PageHeader, Skeleton } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { OPS_LINKS } from '../../lib/section-nav';

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
      <PageHeader title="Operations" subtitle="Live health, alerts, and incident posture.">
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

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
