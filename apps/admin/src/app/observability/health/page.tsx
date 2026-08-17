'use client';

import type { OpsHealthOverview } from '@auvora/sdk';
import { AsyncStates, PageHeader } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { healthLabel, healthTone, formatWhen, safeServiceName } from '../../../lib/admin-format';
import { createApiClient, formatAdminError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

const EXPECTED = [
  { key: 'gateway', label: 'Gateway' },
  { key: 'auth', label: 'Auth' },
  { key: 'wallet', label: 'Wallet' },
  { key: 'blockchain', label: 'Blockchain' },
  { key: 'market', label: 'Market data' },
  { key: 'connection', label: 'Connections' },
  { key: 'postgres', label: 'Postgres' },
  { key: 'redis', label: 'Redis' },
];

function sampleTiming(recent: unknown[]): { lastChecked: string; latency: string } {
  const first = recent.find((item) => item && typeof item === 'object') as
    Record<string, unknown> | undefined;
  if (!first) return { lastChecked: 'Not reported', latency: 'Not reported' };
  const when =
    (typeof first.occurredAt === 'string' && first.occurredAt) ||
    (typeof first.checkedAt === 'string' && first.checkedAt) ||
    (typeof first.generatedAt === 'string' && first.generatedAt) ||
    (typeof first.updatedAt === 'string' && first.updatedAt) ||
    null;
  const latencyValue =
    typeof first.latencyMs === 'number'
      ? first.latencyMs
      : typeof first.durationMs === 'number'
        ? first.durationMs
        : null;
  return {
    lastChecked: when ? formatWhen(when) : 'Not reported',
    latency: latencyValue == null ? 'Not reported' : `${Math.round(latencyValue)} ms`,
  };
}

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
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const services = data?.services ?? [];
  const timing = sampleTiming(Array.isArray(data?.recent) ? data.recent : []);
  const rows = EXPECTED.map((expected) => {
    const found = services.find((service) =>
      service.serviceName.toLowerCase().includes(expected.key),
    );
    return {
      label: expected.label,
      status: found?.status ?? 'UNAVAILABLE',
      reported: found ? safeServiceName(found.serviceName) : 'Not reported',
      lastChecked: found ? timing.lastChecked : 'Not reported',
      latency: found ? timing.latency : 'Not reported',
    };
  });
  const extras = services.filter(
    (service) =>
      !EXPECTED.some((expected) => service.serviceName.toLowerCase().includes(expected.key)),
  );

  return (
    <div className="page">
      <PageHeader
        title="System health"
        subtitle="Aggregated control-plane health. Hostnames and credentials are never shown."
      >
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading health…"
        error={error}
        errorTitle="Health unavailable"
        onRetry={() => void load()}
        empty={false}
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Service health</caption>
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">State</th>
                <th scope="col">Last checked</th>
                <th scope="col">Latency</th>
              </tr>
            </thead>
            <tbody>
              {[
                ...rows,
                ...extras.map((service) => ({
                  label: safeServiceName(service.serviceName),
                  status: service.status,
                  reported: safeServiceName(service.serviceName),
                  lastChecked: timing.lastChecked,
                  latency: timing.latency,
                })),
              ].map((row, index) => (
                <tr key={`${row.label}-${index}`}>
                  <td>{row.label}</td>
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
        {data && Array.isArray(data.recent) && data.recent.length > 0 ? (
          <p className="page-subtitle" style={{ marginTop: '0.75rem' }}>
            Last checked from {data.recent.length} recent sample
            {data.recent.length === 1 ? '' : 's'}.
          </p>
        ) : (
          <p className="page-subtitle" style={{ marginTop: '0.75rem' }}>
            Last checked: not reported.
          </p>
        )}
      </AsyncStates>
    </div>
  );
}
