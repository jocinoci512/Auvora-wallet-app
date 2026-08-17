'use client';

import { AuvoraClientError } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

type ClusterHealth = {
  generatedAt: string;
  status: string;
  activeEnvironmentCount: number;
  recentFailedDeployments: number;
  recentVerifiedBackups: number;
  activeRecoveryDrills: number;
  environments: Array<{ code: string; name: string; isActive: boolean }>;
  notes: string;
};

export default function InfrastructureClusterPage(): ReactElement {
  const [health, setHealth] = useState<ClusterHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setHealth(await client.adminInfrastructureClusterHealth());
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
        <h1>Cluster Health</h1>
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
      {health ? (
        <>
          <p>
            Status <strong>{health.status}</strong> · Generated {health.generatedAt}
          </p>
          <ul className="stack">
            <li>Active environments: {health.activeEnvironmentCount}</li>
            <li>Recent failed deployments: {health.recentFailedDeployments}</li>
            <li>Recent verified backups: {health.recentVerifiedBackups}</li>
            <li>Active recovery drills: {health.activeRecoveryDrills}</li>
          </ul>
          <h2>Environments</h2>
          <ul className="stack">
            {health.environments.map((env) => (
              <li key={env.code}>
                {env.code}: {env.name} {env.isActive ? '(active)' : '(inactive)'}
              </li>
            ))}
          </ul>
          <p className="muted">{health.notes}</p>
        </>
      ) : null}
    </main>
  );
}
