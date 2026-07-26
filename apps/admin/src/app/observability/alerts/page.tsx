'use client';

import { AuvoraClientError, type OpsAlert } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAlertsPage(): ReactElement {
  const [items, setItems] = useState<OpsAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminListObservabilityAlerts();
      setItems(result.items);
    } catch (err) {
      setError(formatApiError(err));
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Alert Center</h1>
        <nav className="page__subnav">
          <Link href="/observability">Dashboard</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul className="stack">
        {items.map((alert) => (
          <li key={alert.id}>
            [{alert.severity}/{alert.status}] {alert.title} — {alert.message}
          </li>
        ))}
        {!items.length && !error ? <li>No alerts.</li> : null}
      </ul>
    </main>
  );
}
