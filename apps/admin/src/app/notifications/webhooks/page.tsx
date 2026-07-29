'use client';

import { AuvoraClientError, type WebhookEndpoint } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminWebhooksPage(): ReactElement {
  const [items, setItems] = useState<WebhookEndpoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.adminListWebhookEndpoints());
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
        <h1>Webhook manager</h1>
        <Link href="/notifications">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((w) => (
          <li key={w.id}>
            {w.name} · {w.url} · {w.isEnabled ? 'on' : 'off'}
          </li>
        ))}
        {!items.length ? <li>No webhooks.</li> : null}
      </ul>
    </main>
  );
}
