'use client';

import { AuvoraClientError, type InfraDeployment } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function InfrastructureDeploymentsPage(): ReactElement {
  const [items, setItems] = useState<InfraDeployment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems((await client.adminListInfraDeployments()).items);
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
        <h1>Deployments</h1>
        <nav className="page__subnav">
          <Link href="/infrastructure">Dashboard</Link>
          <Link href="/infrastructure/environments">Environments</Link>
          <Link href="/infrastructure/deployments">Deployments</Link>
          <Link href="/infrastructure/backups">Backups</Link>
          <Link href="/infrastructure/recovery">Recovery</Link>
          <Link href="/infrastructure/releases">Releases</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul className="stack">
        {items.map((deployment) => (
          <li key={deployment.id}>
            {deployment.environmentCode} {deployment.version} ({deployment.strategy}) —{' '}
            {deployment.status}
          </li>
        ))}
      </ul>
    </main>
  );
}
