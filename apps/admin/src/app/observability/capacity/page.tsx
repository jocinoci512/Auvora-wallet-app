'use client';

import { AuvoraClientError, type OpsCapacityOverview } from '@auvora/sdk';
import { AsyncStates, PageHeader, StatusBadge } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

type CapacityRow = {
  serviceName?: string;
  cpuPercent?: number;
  memoryPercent?: number;
  status?: string;
  [key: string]: unknown;
};

function asRows(latest: unknown[]): CapacityRow[] {
  return latest.filter((row): row is CapacityRow => Boolean(row) && typeof row === 'object');
}

export default function AdminCapacityPage(): ReactElement {
  const [data, setData] = useState<OpsCapacityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setData(await client.adminObservabilityCapacity());
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Your Admin session expired. Sign in again.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = asRows(Array.isArray(data?.latest) ? data.latest : []);

  return (
    <main className="page">
      <PageHeader title="Capacity" subtitle="Latest capacity samples by service.">
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading capacity…"
        error={error}
        errorTitle="Could not load capacity"
        onRetry={() => void load()}
        empty={!loading && !error && rows.length === 0}
        emptyTitle="No capacity samples"
        emptyDescription="Telemetry has not published capacity rows yet."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Capacity by service</caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">CPU %</th>
                <th scope="col">Memory %</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.serviceName ?? index)}>
                  <td>{String(row.serviceName ?? 'unknown')}</td>
                  <td>{row.cpuPercent != null ? String(row.cpuPercent) : '—'}</td>
                  <td>{row.memoryPercent != null ? String(row.memoryPercent) : '—'}</td>
                  <td>{row.status ? <StatusBadge status={String(row.status)} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStates>
    </main>
  );
}
