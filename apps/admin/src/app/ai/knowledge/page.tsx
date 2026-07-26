'use client';

import { AuvoraClientError, type AiKnowledgeSource } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAiKnowledgePage(): ReactElement {
  const [items, setItems] = useState<AiKnowledgeSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.adminListAiKnowledgeSources());
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
        <h1>Knowledge sources</h1>
        <Link href="/ai">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((k) => (
          <li key={k.id}>
            {k.name} · {k.type} · {k.status} · {k.documentCount} docs
            {k.lastSyncedAt ? ` · synced ${new Date(k.lastSyncedAt).toLocaleString()}` : ''}
          </li>
        ))}
        {!items.length ? <li>No knowledge sources.</li> : null}
      </ul>
    </main>
  );
}
