'use client';

import { AuvoraClientError, type AnalyticsReport } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AnalyticsReportsPage(): ReactElement {
  const [reports, setReports] = useState<AnalyticsReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.listAnalyticsReports();
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
          <Link href="/analytics">Overview</Link>
          <Link href="/analytics/reports">Reports</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul className="stack">
        {reports.map((report) => (
          <li key={report.id}>
            {report.name} · {report.format} · {report.status}
            {report.generatedAt ? ` · generated ${report.generatedAt}` : ''}
          </li>
        ))}
        {!reports.length ? <li>No reports yet.</li> : null}
      </ul>
    </main>
  );
}
