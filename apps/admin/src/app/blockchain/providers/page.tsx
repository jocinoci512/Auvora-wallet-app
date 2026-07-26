'use client';

import {
  AuvoraClientError,
  type BlockchainProvider,
  type ProviderHealthSnapshot,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminBlockchainProvidersPage(): ReactElement {
  const [providers, setProviders] = useState<BlockchainProvider[]>([]);
  const [health, setHealth] = useState<ProviderHealthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [providerList, healthList] = await Promise.all([
        client.adminListProviders(),
        client.adminBlockchainHealth(),
      ]);
      setProviders(providerList);
      setHealth(healthList);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function latestHealthFor(providerId: string): ProviderHealthSnapshot | undefined {
    return health
      .filter((h) => h.providerId === providerId)
      .sort((a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime())[0];
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Providers</h1>
          <p className="page-subtitle">{providers.length} configured provider{providers.length === 1 ? '' : 's'}</p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      {loading ? <p className="state-message">Loading providers…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!loading && !error && providers.length === 0 ? (
        <p className="state-message">No providers configured.</p>
      ) : null}

      {!loading && providers.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th>Provider</th>
              <th>Priority</th>
              <th>Enabled</th>
              <th>Primary</th>
              <th>Health</th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => {
              const latest = latestHealthFor(provider.id);
              return (
                <tr key={provider.id}>
                  <td>{provider.chain.replace(/_/g, ' ')}</td>
                  <td>{provider.name}</td>
                  <td>{provider.priority}</td>
                  <td>{provider.isEnabled ? 'Yes' : 'No'}</td>
                  <td>{provider.isPrimary ? <span className="tag">Primary</span> : '—'}</td>
                  <td>
                    {latest ? (
                      <>
                        <span
                          className={`dot ${latest.status === 'HEALTHY' || latest.status === 'ok' ? 'dot--healthy' : 'dot--unhealthy'}`}
                        />
                        {latest.status}
                        {latest.latencyMs !== null ? ` · ${latest.latencyMs}ms` : ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
