'use client';

import { AuvoraClientError, type NotificationPreferences } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function NotificationPreferencesPage(): ReactElement {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [language, setLanguage] = useState('en');
  const [timeZone, setTimeZone] = useState('UTC');
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const p = await client.getNotificationPreferences();
      setPrefs(p);
      setLanguage(p.language);
      setTimeZone(p.timeZone);
      setQuietStart(p.quietHoursStart != null ? String(p.quietHoursStart) : '');
      setQuietEnd(p.quietHoursEnd != null ? String(p.quietHoursEnd) : '');
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

  async function onSave(event: FormEvent): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const client = createApiClient();
      const updated = await client.updateNotificationPreferences({
        language,
        timeZone,
        quietHoursStart: quietStart === '' ? null : Number(quietStart),
        quietHoursEnd: quietEnd === '' ? null : Number(quietEnd),
      });
      setPrefs(updated);
      setMessage('Preferences saved.');
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Notification preferences</h1>
        <Link href="/notifications">← Inbox</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert">{message}</div> : null}
      <form onSubmit={onSave} className="stack">
        <label>
          Language
          <input value={language} onChange={(e) => setLanguage(e.target.value)} />
        </label>
        <label>
          Time zone
          <input value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
        </label>
        <label>
          Quiet hours start (0–23)
          <input value={quietStart} onChange={(e) => setQuietStart(e.target.value)} />
        </label>
        <label>
          Quiet hours end (0–23)
          <input value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} />
        </label>
        <Button type="submit">Save</Button>
      </form>
      {prefs ? <pre>{JSON.stringify(prefs.channelToggles, null, 2)}</pre> : null}
    </main>
  );
}
