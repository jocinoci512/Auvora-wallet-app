'use client';

import { AuvoraClientError, type AnalyticsDashboard } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAnalyticsDashboardsPage(): ReactElement {
  const [dashboards, setDashboards] = useState<AnalyticsDashboard[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setDashboards(await client.adminListAnalyticsDashboards());
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
        <h1>Analytics dashboards</h1>
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
        {dashboards.map((dashboard) => (
          <li key={dashboard.id}>
            {dashboard.name} ({dashboard.code}) · {dashboard.domain ?? 'general'} ·{' '}
            {dashboard.isSystem ? 'system' : 'custom'}
          </li>
        ))}
        {!dashboards.length ? <li>No dashboards configured.</li> : null}
      </ul>
    </main>
  );
}
