'use client';

import { type Refund } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminRefundsPage(): ReactElement {
  const [items, setItems] = useState<Refund[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await createApiClient().adminListRefunds();
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
          <h1>Refunds</h1>
          <p className="page-subtitle">Refund management</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.id.slice(0, 8)}… — {item.amount} {item.currency} — {item.status} —{' '}
            {item.reason ?? 'no reason'}
          </li>
        ))}
      </ul>
    </main>
  );
}
