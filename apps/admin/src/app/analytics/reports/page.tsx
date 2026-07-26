'use client';

import { AuvoraClientError, type AnalyticsReport } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAnalyticsReportsPage(): ReactElement {
  const [reports, setReports] = useState<AnalyticsReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminListAnalyticsReports();
      setReports(result.items);
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
        <h1>Analytics reports</h1>
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
        {reports.map((report) => (
          <li key={report.id}>
            {report.name} · {report.status} · {report.format}
          </li>
        ))}
        {!reports.length ? <li>No reports generated.</li> : null}
      </ul>
    </main>
  );
}
