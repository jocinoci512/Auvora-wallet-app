'use client';

import { AuvoraClientError, type AnalyticsInsightsSummary } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AdminAnalyticsPage(): ReactElement {
  const [insights, setInsights] = useState<AnalyticsInsightsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setInsights(await client.adminAnalyticsInsights());
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
        <h1>Analytics insights</h1>
        <nav className="page__subnav">
          <Link href="/analytics">Insights</Link>
          <Link href="/analytics/dashboards">Dashboards</Link>
          <Link href="/analytics/kpis">KPIs</Link>
          <Link href="/analytics/reports">Reports</Link>
          <Link href="/analytics/forecasts">Forecasts</Link>
          <Link href="/analytics/metrics">Metrics</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {insights ? (
        <>
          <p>
            Generated {insights.generatedAt} · Events {insights.eventVolume}
            {insights.aggregationLagMs != null ? ` · lag ${insights.aggregationLagMs}ms` : ''}
          </p>
          <ul className="stack">
            {insights.insights.map((item, index) => (
              <li key={`${item.title}-${index}`}>
                [{item.severity}] {item.title} — {item.description}
              </li>
            ))}
            {!insights.insights.length ? <li>No insights at this time.</li> : null}
          </ul>
        </>
      ) : null}
    </main>
  );
}
