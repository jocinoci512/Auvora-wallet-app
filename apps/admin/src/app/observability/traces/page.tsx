'use client';

import { AuvoraClientError, type OpsTrace } from '@auvora/sdk';
import { AsyncStates, PageHeader } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

export default function AdminTracesPage(): ReactElement {
  const [items, setItems] = useState<OpsTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setItems((await client.adminSearchObservabilityTraces()).items);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
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
      <PageHeader title="Tracing Explorer" subtitle="Recent distributed traces for diagnosis.">
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading traces…"
        error={error}
        errorTitle="Could not load traces"
        onRetry={() => void load()}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No traces yet"
        emptyDescription="Traces appear when services emit telemetry."
      >
        <ul className="stack">
          {items.map((trace) => (
            <li key={trace.id}>
              <code>{trace.traceId}</code> · {trace.rootService ?? 'unknown'} ·{' '}
              {trace.durationMs ?? '—'}ms · {new Date(trace.startedAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </AsyncStates>
    </main>
  );
}
