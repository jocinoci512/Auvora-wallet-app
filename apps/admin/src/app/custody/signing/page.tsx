'use client';

import { AuvoraClientError, type SigningRequest } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminSigningQueuePage(): ReactElement {
  const [items, setItems] = useState<SigningRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminCustodySigningQueue();
      setItems(result.items);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Signing queue</h1>
        <Link href="/custody">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            {r.status} · {r.requestType} · {r.ownerUserId.slice(0, 8)}… · {r.amount ?? '—'}
          </li>
        ))}
        {!items.length ? <li>Queue empty.</li> : null}
      </ul>
    </main>
  );
}
