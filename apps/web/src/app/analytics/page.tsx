'use client';

import {
  AuvoraClientError,
  type AnalyticsDashboard,
  type AnalyticsKpi,
  type AnalyticsSummary,
} from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function AnalyticsPage(): ReactElement {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [dashboards, setDashboards] = useState<AnalyticsDashboard[]>([]);
  const [kpis, setKpis] = useState<AnalyticsKpi[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const [summaryResult, dashboardList, kpiList] = await Promise.all([
        client.getAnalyticsSummary(),
        client.listAnalyticsDashboards(),
        client.listAnalyticsKpis(),
      ]);
      setSummary(summaryResult);
      setDashboards(dashboardList);
      setKpis(kpiList);
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
        <h1>Analytics</h1>
        <nav className="page__subnav">
          <Link href="/analytics">Overview</Link>
          <Link href="/analytics/reports">Reports</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {summary ? (
        <p>
          Period {summary.period} · Events {summary.totalEvents} · Active users{' '}
          {summary.activeUsers}
        </p>
      ) : null}
      <section className="stack">
        <h2>Dashboards</h2>
        <ul>
          {dashboards.map((dashboard) => (
            <li key={dashboard.id}>
              {dashboard.name} ({dashboard.code}) · {dashboard.isEnabled ? 'enabled' : 'disabled'}
            </li>
          ))}
          {!dashboards.length ? <li>No dashboards available.</li> : null}
        </ul>
      </section>
      <section className="stack">
        <h2>KPIs</h2>
        <ul>
          {kpis.map((kpi) => (
            <li key={kpi.id}>
              {kpi.name} · current {kpi.currentValue ?? '—'} / target {kpi.targetValue ?? '—'}
            </li>
          ))}
          {!kpis.length ? <li>No KPIs configured.</li> : null}
        </ul>
      </section>
    </main>
  );
}
