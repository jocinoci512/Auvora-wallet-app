'use client';

import { AuvoraClientError, type NotificationTemplate } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminTemplatesPage(): ReactElement {
  const [items, setItems] = useState<NotificationTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems(await client.adminListNotificationTemplates());
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

  return (
    <main className="page">
      <header className="page__header">
        <h1>Template manager</h1>
        <Link href="/notifications">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((t) => (
          <li key={t.id}>
            {t.code} · {t.channel} · {t.locale} · v{t.currentVersion}
          </li>
        ))}
        {!items.length ? <li>No templates.</li> : null}
      </ul>
    </main>
  );
}
