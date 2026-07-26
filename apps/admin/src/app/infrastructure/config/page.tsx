'use client';

import { AuvoraClientError, type FeatureFlag } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function InfrastructureConfigPage(): ReactElement {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setFlags(await client.adminListFeatureFlags());
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
        <h1>Configuration</h1>
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
      <p>Runtime feature flags (environment-scoped). Secrets are never displayed.</p>
      <ul className="stack">
        {flags.map((flag) => (
          <li key={flag.id ?? flag.code}>
            <code>{flag.code}</code> — {flag.enabled ? 'enabled' : 'disabled'}
            {flag.environmentCode ? ` · ${flag.environmentCode}` : ' · all envs'}
            {flag.description ? ` — ${flag.description}` : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
