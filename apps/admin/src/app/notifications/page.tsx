'use client';

import {
  AuvoraClientError,
  type NotificationDashboardMetrics,
  type NotificationProvider,
} from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminNotificationsPage(): ReactElement {
  const [metrics, setMetrics] = useState<NotificationDashboardMetrics | null>(null);
  const [providers, setProviders] = useState<NotificationProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const [m, p] = await Promise.all([
        client.adminNotificationDashboard(),
        client.adminListNotificationProviders(),
      ]);
      setMetrics(m);
      setProviders(p);
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
        <h1>Notification dashboard</h1>
        <nav className="page__subnav">
          <Link href="/notifications">Dashboard</Link>
          <Link href="/notifications/templates">Templates</Link>
          <Link href="/notifications/queue">Queue</Link>
          <Link href="/notifications/failed">Failed</Link>
          <Link href="/notifications/broadcast">Broadcast</Link>
          <Link href="/notifications/webhooks">Webhooks</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {metrics ? (
        <p>
          Queue: {metrics.queueLength} · Sent: {metrics.sent} · Delivered: {metrics.delivered} ·
          Failed: {metrics.failed} · Dead letter: {metrics.deadLetter} · Avg latency:{' '}
          {Math.round(metrics.averageLatencyMs)}ms · Success:{' '}
          {Math.round(metrics.successRate * 100)}%
        </p>
      ) : null}
      <section className="stack">
        <h2>Providers</h2>
        <ul>
          {providers.map((p) => (
            <li key={p.id}>
              {p.code} · {p.channel} · {p.healthStatus} · {p.isEnabled ? 'on' : 'off'}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
