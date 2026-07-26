'use client';

import { type Dispute } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminDisputesPage(): ReactElement {
  const [items, setItems] = useState<Dispute[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await createApiClient().adminListDisputes();
      setItems(result.items);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Disputes</h1>
          <p className="page-subtitle">Dispute management</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.id.slice(0, 8)}… — {item.status} — {item.reason ?? '—'}
          </li>
        ))}
      </ul>
    </main>
  );
}
