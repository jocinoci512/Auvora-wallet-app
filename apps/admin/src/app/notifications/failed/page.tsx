'use client';

import { AuvoraClientError, type NotificationItem } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminFailedPage(): ReactElement {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminFailedNotifications();
      setItems(result.items);
    } catch (err) {
      setError(err instanceof AuvoraClientError && err.status === 401
        ? 'Unauthorized — save a JWT access token above.'
        : formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Failed deliveries</h1>
        <Link href="/notifications">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((n) => (
          <li key={n.id}>
            {n.status} · {n.channel} · {n.failureReason ?? '—'}
          </li>
        ))}
        {!items.length ? <li>No failed deliveries.</li> : null}
      </ul>
    </main>
  );
}
