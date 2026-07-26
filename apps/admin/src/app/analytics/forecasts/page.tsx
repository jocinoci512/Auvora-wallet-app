'use client';

import { AuvoraClientError, type AnalyticsForecast } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAnalyticsForecastsPage(): ReactElement {
  const [forecasts, setForecasts] = useState<AnalyticsForecast[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setForecasts(await client.adminListAnalyticsForecasts());
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
        <h1>Analytics forecasts</h1>
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
        {forecasts.map((forecast) => (
          <li key={forecast.id}>
            {forecast.name} ({forecast.code}) · {forecast.metricCode} · {forecast.algorithm} ·{' '}
            {forecast.isEnabled ? 'enabled' : 'disabled'}
          </li>
        ))}
        {!forecasts.length ? <li>No forecast models.</li> : null}
      </ul>
    </main>
  );
}
