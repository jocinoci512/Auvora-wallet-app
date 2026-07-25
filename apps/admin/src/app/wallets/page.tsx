'use client';

import { AuvoraClientError, type Wallet, type WalletStatus } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

const STATUSES: Array<WalletStatus | ''> = ['', 'PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];

function statusClass(status: Wallet['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

export default function AdminWalletsPage(): ReactElement {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [status, setStatus] = useState<WalletStatus | ''>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListWallets({
        ownerUserId: search.trim() || undefined,
        assetCode: assetCode.trim() || undefined,
        status: status || undefined,
      });
      setWallets(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [search, assetCode, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Wallets</h1>
          <p className="page-subtitle">{total} wallet{total === 1 ? '' : 's'} found</p>
        </div>
      </header>

      <section className="panel filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Owner user ID</span>
            <input
              className="field-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="UUID"
            />
          </label>
          <label className="field">
            <span className="field-label">Asset code</span>
            <input
              className="field-input"
              value={assetCode}
              onChange={(e) => setAssetCode(e.target.value)}
              placeholder="BTC, ETH…"
            />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as WalletStatus | '')}
            >
              {STATUSES.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s || 'All'}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={() => void load()}>
            Search
          </Button>
        </div>
      </section>

      {loading ? <p className="state-message">Loading wallets…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!loading && !error && wallets.length === 0 ? (
        <p className="state-message">No wallets match your filters.</p>
      ) : null}

      {!loading && wallets.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Label</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <tr key={wallet.id}>
                <td>{wallet.assetCode}</td>
                <td>{wallet.label ?? '—'}</td>
                <td className="mono">{wallet.ownerUserId.slice(0, 8)}…</td>
                <td>
                  <span className={statusClass(wallet.status)}>{wallet.status}</span>
                </td>
                <td>{new Date(wallet.createdAt).toLocaleDateString()}</td>
                <td>
                  <Link href={`/wallets/${wallet.id}`}>View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
