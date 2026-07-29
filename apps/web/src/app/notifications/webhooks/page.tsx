'use client';

import { AuvoraClientError, type WebhookEndpoint } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function NotificationWebhooksPage(): ReactElement {
  const [items, setItems] = useState<WebhookEndpoint[]>([]);
  const [name, setName] = useState('My webhook');
  const [url, setUrl] = useState('https://example.com/hooks/auvora');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.listWebhookEndpoints());
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

  async function onCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const client = createApiClient();
      await client.createWebhookEndpoint({ name, url });
      setMessage('Webhook registered.');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Connected webhooks</h1>
        <Link href="/notifications">← Inbox</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert">{message}</div> : null}
      <form onSubmit={onCreate} className="stack">
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          URL
          <input value={url} onChange={(e) => setUrl(e.target.value)} required />
        </label>
        <Button type="submit">Register</Button>
      </form>
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
