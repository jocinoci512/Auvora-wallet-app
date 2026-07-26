'use client';

import { AuvoraClientError, type InfraBackupJob } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function InfrastructureBackupsPage(): ReactElement {
  const [items, setItems] = useState<InfraBackupJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setItems((await client.adminListInfraBackups()).items);
      setError(null);
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
        <h1>Backups</h1>
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
        {items.map((backup) => (
          <li key={backup.id}>
            {backup.componentName} ({backup.componentKind}) — {backup.status}
            {backup.location ? ` · ${backup.location}` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
