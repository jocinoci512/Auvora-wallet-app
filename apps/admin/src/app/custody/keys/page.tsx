'use client';

import { AuvoraClientError, type CustodyKey } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminCustodyKeysPage(): ReactElement {
  const [items, setItems] = useState<CustodyKey[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminListCustodyKeys();
      setItems(result.items);
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
        <h1>Key management</h1>
        <Link href="/custody">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((k) => (
          <li key={k.id}>
            {k.id.slice(0, 8)}… · {k.algorithm} · {k.custodyModel} · {k.status}
          </li>
        ))}
        {!items.length ? <li>No keys visible for this session.</li> : null}
      </ul>
    </main>
  );
}
