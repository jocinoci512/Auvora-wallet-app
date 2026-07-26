'use client';

import { AuvoraClientError, type AiConversation } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAiConversationsPage(): ReactElement {
  const [items, setItems] = useState<AiConversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminListAiConversations();
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
        <h1>Conversation browser</h1>
        <Link href="/ai">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((c) => (
          <li key={c.id}>
            {c.title ?? c.id} · {c.status} · updated {new Date(c.updatedAt).toLocaleString()}
          </li>
        ))}
        {!items.length ? <li>No conversations.</li> : null}
      </ul>
    </main>
  );
}
