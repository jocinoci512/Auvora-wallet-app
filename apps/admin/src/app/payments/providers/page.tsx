'use client';

import { type PaymentProvider, type PaymentProviderHealth } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminProvidersPage(): ReactElement {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [health, setHealth] = useState<PaymentProviderHealth[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const [p, h] = await Promise.all([
        client.adminListPaymentProviders(),
        client.adminPaymentHealth(),
      ]);
      setProviders(p);
      setHealth(h);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Payment providers</h1>
          <p className="page-subtitle">Provider management and health</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Type</th>
            <th>Enabled</th>
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          {providers.map((provider) => {
            const latest = health.find((item) => item.providerCode === provider.code);
            return (
              <tr key={provider.id}>
                <td>{provider.code}</td>
                <td>{provider.name}</td>
                <td>{provider.providerType}</td>
                <td>{provider.isEnabled ? 'yes' : 'no'}</td>
                <td>
                  {latest ? `${latest.status} (${latest.latencyMs ?? '—'}ms)` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
