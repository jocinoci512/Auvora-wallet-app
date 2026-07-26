'use client';

import { type OpsTrace } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminTracesPage(): ReactElement {
  const [items, setItems] = useState<OpsTrace[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems((await client.adminSearchObservabilityTraces()).items);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Tracing Explorer</h1>
        <nav className="page__subnav">
          <Link href="/observability">Dashboard</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul className="stack">
        {items.map((trace) => (
          <li key={trace.id}>
            {trace.traceId} · {trace.rootService ?? 'unknown'} · {trace.durationMs ?? '-'}ms
          </li>
        ))}
        {!items.length && !error ? <li>No traces yet.</li> : null}
      </ul>
    </main>
  );
}
