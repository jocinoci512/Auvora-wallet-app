'use client';

import { AuvoraClientError, type OpsLogEntry } from '@auvora/sdk';
import { AsyncStates, PageHeader } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

function safeLogRow(entry: OpsLogEntry): {
  id: string;
  serviceName: string;
  level: string;
  message: string;
  occurredAt: string;
} {
  return {
    id: entry.id,
    serviceName: entry.serviceName,
    level: entry.level,
    message: entry.message,
    occurredAt: entry.occurredAt,
  };
}

export default function AdminLogsPage(): ReactElement {
  const [items, setItems] = useState<OpsLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminSearchObservabilityLogs();
      setItems(result.items.map(safeLogRow));
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Your Admin session expired. Sign in again.'
          : err instanceof AuvoraClientError && err.status === 403
            ? 'You do not have permission to view operations logs.'
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
        title="Operations logs"
        subtitle="Masked service log entries. Raw payloads and secrets are not displayed."
      >
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading operations logs…"
        error={error}
        errorTitle="Could not load logs"
        onRetry={() => void load()}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No log entries"
        emptyDescription="Structured operations logs appear here after services emit telemetry."
      >
        <p className="page-subtitle">{total} matching entries</p>
        <ul className="stack">
          {items.map((entry) => {
            const row = safeLogRow(entry);
            return (
              <li key={row.id}>
                <strong>{row.level}</strong> · {row.serviceName} · {row.message} ·{' '}
                {new Date(row.occurredAt).toLocaleString()}
              </li>
            );
          })}
        </ul>
      </AsyncStates>
    </main>
  );
}
