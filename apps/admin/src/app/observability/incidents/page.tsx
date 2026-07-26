'use client';

import { type OpsIncident } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminIncidentsPage(): ReactElement {
  const [items, setItems] = useState<OpsIncident[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems((await client.adminListObservabilityIncidents()).items);
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
        <h1>Incident Center</h1>
        <nav className="page__subnav">
          <Link href="/observability">Dashboard</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul className="stack">
        {items.map((incident) => (
          <li key={incident.id}>
            {incident.code} [{incident.severity}/{incident.status}] {incident.title}
          </li>
        ))}
        {!items.length && !error ? <li>No incidents.</li> : null}
      </ul>
    </main>
  );
}
