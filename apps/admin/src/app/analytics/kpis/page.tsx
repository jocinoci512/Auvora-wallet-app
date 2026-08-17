'use client';

import { AuvoraClientError, type AnalyticsKpi } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAnalyticsKpisPage(): ReactElement {
  const [kpis, setKpis] = useState<AnalyticsKpi[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setKpis(await client.adminListAnalyticsKpis());
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
        <h1>Analytics KPIs</h1>
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
        {kpis.map((kpi) => (
          <li key={kpi.id}>
            {kpi.name} ({kpi.code}) · metric {kpi.metricCode} · status {kpi.status ?? 'unknown'}
          </li>
        ))}
        {!kpis.length ? <li>No KPI definitions.</li> : null}
      </ul>
    </main>
  );
}
