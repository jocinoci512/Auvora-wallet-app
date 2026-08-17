'use client';

import { AuvoraClientError, type OpsSlo } from '@auvora/sdk';
import { AsyncStates, PageHeader } from '@auvora/ui';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { OPS_LINKS } from '../../../lib/section-nav';

export default function AdminSlosPage(): ReactElement {
  const [items, setItems] = useState<OpsSlo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setItems(await client.adminListObservabilitySlos());
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

  return (
    <main className="page">
      <PageHeader title="SLO Dashboard" subtitle="Service level objectives and targets.">
        <Subnav label="Observability sections" links={OPS_LINKS} />
      </PageHeader>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading SLOs…"
        error={error}
        errorTitle="Could not load SLOs"
        onRetry={() => void load()}
        empty={!loading && !error && items.length === 0}
        emptyTitle="No SLOs configured"
        emptyDescription="Create SLOs via the observability admin API."
      >
        <ul className="stack">
          {items.map((slo) => (
            <li key={slo.id}>
              <strong>{slo.code}</strong> — {slo.name} ({slo.serviceName}) target{' '}
              {slo.targetPercent}% · {slo.indicatorType}
            </li>
          ))}
        </ul>
      </AsyncStates>
    </main>
  );
}
