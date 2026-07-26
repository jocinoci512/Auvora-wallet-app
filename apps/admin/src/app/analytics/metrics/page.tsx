'use client';

import { AuvoraClientError, type AnalyticsMetricDefinition } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAnalyticsMetricsPage(): ReactElement {
  const [metrics, setMetrics] = useState<AnalyticsMetricDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setMetrics(await client.adminListAnalyticsMetrics());
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
        <h1>Analytics metrics</h1>
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
      <ul className="stack">
        {metrics.map((metric) => (
          <li key={metric.id}>
            {metric.name} ({metric.code}) · {metric.domain} · {metric.valueType}
            {metric.unit ? ` · ${metric.unit}` : ''}
          </li>
        ))}
        {!metrics.length ? <li>No metric definitions.</li> : null}
      </ul>
    </main>
  );
}
