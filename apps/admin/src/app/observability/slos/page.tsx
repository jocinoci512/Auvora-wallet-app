'use client';

import { type OpsSlo } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminSlosPage(): ReactElement {
  const [items, setItems] = useState<OpsSlo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.adminListObservabilitySlos());
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
        <h1>SLO Dashboard</h1>
        <nav className="page__subnav">
          <Link href="/observability">Dashboard</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul className="stack">
        {items.map((slo) => (
          <li key={slo.id}>
            {slo.code} — {slo.name} ({slo.serviceName}) target {slo.targetPercent}%
          </li>
        ))}
        {!items.length && !error ? <li>No SLOs configured.</li> : null}
      </ul>
    </main>
  );
}
