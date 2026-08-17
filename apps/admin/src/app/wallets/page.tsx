'use client';

import type { Wallet, WalletStatus } from '@auvora/sdk';
import { AsyncStates, Button, PageHeader, Pagination, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { formatWhen, shortId } from '../../lib/admin-format';
import { createApiClient, formatAdminError } from '../../lib/api-client';

const STATUSES: Array<WalletStatus | ''> = ['', 'PENDING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'];
const PAGE_SIZE = 25;

export default function AdminWalletsPage(): ReactElement {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [assetCode, setAssetCode] = useState('');
  const [status, setStatus] = useState<WalletStatus | ''>('');
  const [applied, setApplied] = useState({
    search: '',
    assetCode: '',
    status: '' as WalletStatus | '',
    page: 1,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListWallets({
        ownerUserId: applied.search.trim() || undefined,
        assetCode: applied.assetCode.trim() || undefined,
        status: applied.status || undefined,
        skip: (applied.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setWallets(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="page">
      <PageHeader
        title="Wallets"
        subtitle={
          loading ? 'Searching…' : `${total.toLocaleString()} wallet${total === 1 ? '' : 's'}`
        }
      />

      <section className="panel filters" aria-label="Wallet filters">
        <form
          className="filters__row"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({ search, assetCode, status, page: 1 });
          }}
        >
          <label className="field">
            <span className="field-label">Owner user ID</span>
            <input
              className="field-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="UUID"
            />
          </label>
          <label className="field">
            <span className="field-label">Asset</span>
            <input
              className="field-input"
              value={assetCode}
              onChange={(event) => setAssetCode(event.target.value)}
              placeholder="BTC, ETH…"
            />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(event) => setStatus(event.target.value as WalletStatus | '')}
            >
              {STATUSES.map((item) => (
                <option key={item || 'all'} value={item}>
                  {item || 'All'}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Search</Button>
        </form>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading wallets…"
        error={error}
        errorTitle="Could not load wallets"
        onRetry={() => void load()}
        empty={!loading && !error && wallets.length === 0}
        emptyTitle="No wallets match"
        emptyDescription="Try clearing filters or a different owner ID."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Wallet metadata</caption>
            <thead>
              <tr>
                <th scope="col">Wallet ID</th>
                <th scope="col">Network / asset</th>
                <th scope="col">Owner</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <span className="auvora-sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((wallet) => (
                <tr key={wallet.id}>
                  <td className="mono">{shortId(wallet.id, 12)}</td>
                  <td>{wallet.assetCode}</td>
                  <td className="mono">{shortId(wallet.ownerUserId, 10)}</td>
                  <td>
                    <StatusBadge status={wallet.status} />
                  </td>
                  <td>{formatWhen(wallet.createdAt)}</td>
                  <td>
                    <Link href={`/wallets/${wallet.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={applied.page}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={(page) => setApplied((current) => ({ ...current, page }))}
        />
      </AsyncStates>
    </div>
  );
}
