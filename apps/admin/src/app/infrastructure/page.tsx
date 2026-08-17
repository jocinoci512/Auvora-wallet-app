'use client';

import { AuvoraClientError, type InfraDashboardOverview } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function InfrastructureDashboardPage(): ReactElement {
  const [overview, setOverview] = useState<InfraDashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setOverview(await client.adminInfrastructureDashboard());
      setError(null);
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
        <h1>Infrastructure</h1>
        <nav className="page__subnav">
          <Link href="/infrastructure">Dashboard</Link>
          <Link href="/infrastructure/environments">Environments</Link>
          <Link href="/infrastructure/config">Config</Link>
          <Link href="/infrastructure/cluster">Cluster</Link>
          <Link href="/infrastructure/deployments">Deployments</Link>
          <Link href="/infrastructure/backups">Backups</Link>
          <Link href="/infrastructure/recovery">Recovery</Link>
          <Link href="/infrastructure/releases">Releases</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {overview ? (
        <>
          <p>
            Generated {overview.generatedAt} · Active environments {overview.activeEnvironmentCount}{' '}
            · Enabled flags {overview.enabledFeatureFlagCount}
          </p>
          <h2>Recent deployments</h2>
          <ul className="stack">
            {overview.recentDeployments.map((deployment) => (
              <li key={deployment.id}>
                {deployment.environmentCode} {deployment.version} — {deployment.status}
              </li>
            ))}
          </ul>
          <h2>Recent backups</h2>
          <ul className="stack">
            {overview.recentBackups.map((backup) => (
              <li key={backup.id}>
                {backup.componentName} ({backup.componentKind}) — {backup.status}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </main>
  );
}
