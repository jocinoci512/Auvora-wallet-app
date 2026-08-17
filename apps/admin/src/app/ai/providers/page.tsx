'use client';

import { AuvoraClientError, type AiProvider } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAiProvidersPage(): ReactElement {
  const [items, setItems] = useState<AiProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.adminListAiProviders());
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Your Admin session expired. Sign in again.'
          : formatApiError(err),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(provider: AiProvider): Promise<void> {
    setError(null);
    try {
      const client = createApiClient();
      if (provider.isEnabled) {
        await client.adminDisableAiProvider(provider.id);
      } else {
        await client.adminEnableAiProvider(provider.id);
      }
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>AI providers</h1>
        <Link href="/ai">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((p) => (
          <li key={p.id}>
            {p.code} · {p.name} · {p.model} · priority {p.priority} · {p.healthStatus} ·{' '}
            {p.isEnabled ? 'enabled' : 'disabled'}{' '}
            <Button type="button" onClick={() => void toggle(p)}>
              {p.isEnabled ? 'Disable' : 'Enable'}
            </Button>
          </li>
        ))}
        {!items.length ? <li>No providers configured.</li> : null}
      </ul>
    </main>
  );
}
