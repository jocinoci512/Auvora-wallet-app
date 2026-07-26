'use client';

import { AuvoraClientError, type NotificationItem, type NotificationPreferences } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function NotificationsPage(): ReactElement {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const [list, preferences] = await Promise.all([
        client.listNotifications(),
        client.getNotificationPreferences(),
      ]);
      setItems(list.items);
      setPrefs(preferences);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string): Promise<void> {
    try {
      const client = createApiClient();
      await client.markNotificationRead(id);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Notification center</h1>
        <nav className="page__subnav">
          <Link href="/notifications">Inbox</Link>
          <Link href="/notifications/preferences">Preferences</Link>
          <Link href="/notifications/webhooks">Webhooks</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {prefs ? (
        <p>
          Language {prefs.language} · TZ {prefs.timeZone}
          {prefs.quietHoursStart != null
            ? ` · Quiet ${prefs.quietHoursStart}:00–${prefs.quietHoursEnd ?? '?'}:00`
            : ''}
        </p>
      ) : null}
      <ul className="stack">
        {items.map((n) => (
          <li key={n.id}>
            <strong>{n.subject ?? n.category}</strong> · {n.channel} · {n.status}
            <div>{n.body}</div>
            {n.status !== 'DELIVERED' ? (
              <Button type="button" onClick={() => void markRead(n.id)}>
                Mark read
              </Button>
            ) : null}
          </li>
        ))}
        {!items.length ? <li>No notifications.</li> : null}
      </ul>
    </main>
  );
}
