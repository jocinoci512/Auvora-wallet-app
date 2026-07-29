'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminBroadcastPage(): ReactElement {
  const [subject, setSubject] = useState('System announcement');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSend(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const client = createApiClient();
      const result = await client.adminBroadcastNotification({
        subject,
        body,
        channel: 'IN_APP',
        category: 'ADMIN',
      });
      setMessage(`Broadcast queued (${result.recipientCount} recipients).`);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Broadcast center</h1>
        <Link href="/notifications">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert">{message}</div> : null}
      <form onSubmit={onSend} className="stack">
        <label>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Body
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required rows={5} />
        </label>
        <Button type="submit">Send broadcast</Button>
      </form>
    </main>
  );
}
