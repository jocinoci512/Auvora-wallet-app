'use client';

import { AuvoraClientError, type Wallet, type WalletStatus } from '@auvora/sdk';
import { AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

const STATUSES: Array<WalletStatus | ''> = ['', 'PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];

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
      <PageHeader
        title="Wallets"
        subtitle={loading ? 'Searching…' : `${total} wallet${total === 1 ? '' : 's'} found`}
      />

      <section className="panel filters" aria-label="Wallet filters">
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

      <AsyncStates
        loading={loading}
        loadingMessage="Loading wallets…"
        error={error}
        errorTitle="Could not load wallets"
        onRetry={() => void load()}
        empty={!loading && !error && wallets.length === 0}
        emptyTitle="No wallets match"
        emptyDescription="Try clearing filters or searching by a different owner or asset."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Admin wallet search results</caption>
            <thead>
              <tr>
                <th scope="col">Asset</th>
                <th scope="col">Label</th>
                <th scope="col">Owner</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <span className="auvora-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet) => (
                <tr key={wallet.id}>
                  <td>{wallet.assetCode}</td>
                  <td>{wallet.label ?? '—'}</td>
                  <td className="mono">{wallet.ownerUserId.slice(0, 8)}…</td>
                  <td>
                    <StatusBadge status={wallet.status} />
                  </td>
                  <td>{new Date(wallet.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Link href={`/wallets/${wallet.id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStates>
    </main>
  );
}
