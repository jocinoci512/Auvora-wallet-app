'use client';

import { AuvoraClientError, type AiDashboardMetrics, type AiProvider } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminAiPage(): ReactElement {
  const [metrics, setMetrics] = useState<AiDashboardMetrics | null>(null);
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const [m, p] = await Promise.all([client.adminAiDashboard(), client.adminListAiProviders()]);
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
        <h1>AI platform dashboard</h1>
        <nav className="page__subnav">
          <Link href="/ai">Dashboard</Link>
          <Link href="/ai/providers">Providers</Link>
          <Link href="/ai/prompts">Prompts</Link>
          <Link href="/ai/knowledge">Knowledge</Link>
          <Link href="/ai/usage">Usage</Link>
          <Link href="/ai/conversations">Conversations</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {metrics ? (
        <p>
          Conversations: {metrics.totalConversations} · Messages: {metrics.totalMessages} · Active
          users: {metrics.activeUsers} · Avg latency: {Math.round(metrics.averageLatencyMs)}ms ·
          Tokens used: {metrics.totalTokensUsed} · Error rate: {Math.round(metrics.errorRate * 100)}
          %
        </p>
      ) : null}
      <section className="stack">
        <h2>Providers</h2>
        <ul>
          {providers.map((p) => (
            <li key={p.id}>
              {p.code} · {p.model} · {p.healthStatus} · {p.isEnabled ? 'on' : 'off'}
            </li>
          ))}
          {!providers.length ? <li>No providers configured.</li> : null}
        </ul>
      </section>
    </main>
  );
}
