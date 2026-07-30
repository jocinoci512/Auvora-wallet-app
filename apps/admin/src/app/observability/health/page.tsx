'use client';

import { AuvoraClientError, type OpsHealthOverview } from '@auvora/sdk';
import { AsyncStates, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

export default function AdminHealthPage(): ReactElement {
  const [data, setData] = useState<OpsHealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setData(await client.adminObservabilityHealth());
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
      <PageHeader
        title="Service health"
        subtitle="Aggregated health from the observability monitor — API, DB, cache, and workers when reported."
      >
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading health…"
        error={error}
        errorTitle="Could not load health"
        onRetry={() => void load()}
        empty={!loading && !error && (!data || data.services.length === 0)}
        emptyTitle="No health samples"
        emptyDescription="Services have not reported status to the observability monitor yet."
      >
        {data ? (
          <>
            <ul className="stack">
              {data.services.map((service) => (
                <li key={service.serviceName}>
                  <span
                    className={`dot ${service.status === 'OK' || service.status === 'HEALTHY' ? 'dot--healthy' : 'dot--unhealthy'}`}
                    aria-hidden
                  />
                  {service.serviceName}: <StatusBadge status={service.status} />
                </li>
              ))}
            </ul>
            {Array.isArray(data.recent) && data.recent.length > 0 ? (
              <section style={{ marginTop: '1.5rem' }}>
                <h2>Recent samples</h2>
                <ul className="stack">
                  {data.recent.slice(0, 20).map((sample, index) => {
                    const row = sample as Record<string, unknown>;
                    const name = String(row.serviceName ?? row.service ?? `sample-${index}`);
                    const status = String(row.status ?? 'unknown');
                    return (
                      <li key={`${name}-${index}`}>
                        <StatusBadge status={status} /> {name}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </AsyncStates>
    </main>
  );
}
