'use client';

import { AuvoraClientError, type CustodyActivityItem } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function CustodyActivityPage(): ReactElement {
  const [items, setItems] = useState<CustodyActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.listCustodyActivity());
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Security activity</h1>
        <Link href="/custody">← Custody</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.createdAt} · {item.action}
          </li>
        ))}
        {!items.length ? <li>No activity yet.</li> : null}
      </ul>
    </main>
  );
}
