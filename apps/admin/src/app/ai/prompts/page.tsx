'use client';

import { AuvoraClientError, type AiPrompt } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAiPromptsPage(): ReactElement {
  const [items, setItems] = useState<AiPrompt[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.adminListAiPrompts());
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
        <h1>Prompt manager</h1>
        <Link href="/ai">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            {p.code} · {p.category} · v{p.currentVersion} · {p.isEnabled ? 'enabled' : 'disabled'}
          </li>
        ))}
        {!items.length ? <li>No prompts.</li> : null}
      </ul>
    </main>
  );
}
