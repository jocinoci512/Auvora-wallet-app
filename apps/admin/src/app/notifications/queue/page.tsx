'use client';

import { AuvoraClientError, type NotificationQueueItem } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminQueuePage(): ReactElement {
  const [items, setItems] = useState<NotificationQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminNotificationQueue();
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
        <h1>Queue monitor</h1>
        <Link href="/notifications">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((q) => (
          <li key={q.id}>
            {q.status} · priority {q.priority} · attempts {q.attemptCount}
          </li>
        ))}
        {!items.length ? <li>Queue empty.</li> : null}
      </ul>
    </main>
  );
}
