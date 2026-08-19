'use client';

import type { ProductionMeshHealth } from '@auvora/sdk';
import { AsyncStates, PageHeader } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { healthLabel, healthTone, formatWhen } from '../../../lib/admin-format';
import { createApiClient, formatAdminError } from '../../../lib/api-client';
import { useAdminRealtimeContext, useRealtimeRefetch } from '../../../lib/admin-realtime-context';
import type { AdminEvent } from '../../../lib/realtime/admin-event';
import { OPS_LINKS } from '../../../lib/section-nav';

const PRODUCTION_MESH = [
  'gateway-prod',
  'auth-prods',
  'wallet-prod',
  'blockchain-prod',
  'market-data-prod',
  'connections-prod',
  'Postgres',
  'Redis',
] as const;

function shouldRefreshHealth(event: AdminEvent): boolean {
  return event.type === 'SERVICE_HEALTH_CHANGED';
}

export default function AdminHealthPage(): ReactElement {
  const [data, setData] = useState<ProductionMeshHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setData(await client.adminProductionSystemHealth());
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefetch(shouldRefreshHealth, () => void load(), 1500);

  const { status: realtimeStatus } = useAdminRealtimeContext();
  const byId = new Map((data?.services ?? []).map((row) => [row.id, row]));
  const rows = PRODUCTION_MESH.map((id) => {
    const found = byId.get(id);
    return {
      id,
      status: found?.status ?? 'unknown',
      lastChecked: data?.generatedAt ? formatWhen(data.generatedAt) : 'Not reported',
      latency: found?.latencyMs == null ? 'Not reported' : `${Math.round(found.latencyMs)} ms`,
    };
  });

  return (
    <div className="page">
      <PageHeader
        title="System health"
        subtitle="Production mesh only. Legacy Railway services are never shown."
      >
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>
      <p className="page-subtitle">Realtime {realtimeStatus}</p>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading production health…"
        error={error}
        errorTitle="Health unavailable"
        onRetry={() => void load()}
        empty={false}
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Production service health</caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">State</th>
                <th scope="col">Last checked</th>
                <th scope="col">Latency</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>
                    <span className={`health-pill health-pill--${healthTone(row.status)}`}>
                      {healthLabel(row.status)}
                    </span>
                  </td>
                  <td>{row.lastChecked}</td>
                  <td>{row.latency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStates>
    </div>
  );
}
