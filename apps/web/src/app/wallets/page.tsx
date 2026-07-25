'use client';

import { AuvoraClientError, type Wallet } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

function statusClass(status: Wallet['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

export default function WalletsPage(): ReactElement {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);
    try {
      const client = createApiClient();
      const result = await client.listWallets();
      setWallets(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setUnauthorized(true);
        setWallets([]);
        setTotal(0);
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

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Wallets</h1>
          <p className="page-subtitle">{total} wallet{total === 1 ? '' : 's'}</p>
        </div>
        <Link href="/wallets/new">
          <Button>New wallet</Button>
        </Link>
      </header>

      {loading ? <p className="state-message">Loading wallets…</p> : null}

      {unauthorized ? (
        <div className="alert alert--warn">
          <strong>Sign in required.</strong> Save a JWT access token above, then refresh this page.
          Use <code>POST /api/v1/auth/login</code> on the gateway to obtain one.
        </div>
      ) : null}

      {error ? (
        <div className="alert alert--error">
          {error}
          <Button type="button" variant="secondary" onClick={() => void load()} style={{ marginTop: '0.75rem' }}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error && !unauthorized && wallets.length === 0 ? (
        <p className="state-message">No wallets yet. Create your first wallet to get started.</p>
      ) : null}

      {!loading && wallets.length > 0 ? (
        <ul className="wallet-list">
          {wallets.map((wallet) => (
            <li key={wallet.id} className="wallet-card">
              <Link href={`/wallets/${wallet.id}`} className="wallet-card__link">
                <div className="wallet-card__primary">
                  <span className="wallet-card__asset">{wallet.assetCode}</span>
                  {wallet.label ? <span className="wallet-card__label">{wallet.label}</span> : null}
                  {wallet.alias ? <span className="wallet-card__alias">{wallet.alias}</span> : null}
                </div>
                <span className={statusClass(wallet.status)}>{wallet.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
