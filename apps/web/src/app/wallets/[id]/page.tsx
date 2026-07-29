'use client';

import {
  AuvoraClientError,
  type Wallet,
  type WalletBalance,
  type WalletTransaction,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

function statusClass(status: Wallet['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

export default function WalletDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const walletId = params.id;

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [label, setLabel] = useState('');
  const [alias, setAlias] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [walletData, balanceData, txData] = await Promise.all([
        client.getWallet(walletId),
        client.getWalletBalance(walletId),
        client.getWalletTransactions(walletId),
      ]);
      setWallet(walletData);
      setLabel(walletData.label ?? '');
      setAlias(walletData.alias ?? '');
      setBalance(balanceData);
      setTransactions(txData);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setActionError(null);
    try {
      const client = createApiClient();
      const updated = await client.updateWallet(walletId, {
        label: label.trim() || undefined,
        alias: alias.trim() || undefined,
      });
      setWallet(updated);
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action: 'suspend' | 'archive' | 'restore' | 'activate'): Promise<void> {
    setActing(true);
    setActionError(null);
    try {
      const client = createApiClient();
      let updated: Wallet;
      switch (action) {
        case 'suspend':
          updated = await client.suspendWallet(walletId);
          break;
        case 'archive':
          updated = await client.archiveWallet(walletId);
          break;
        case 'restore':
          updated = await client.restoreWallet(walletId);
          break;
        case 'activate':
          updated = await client.activateWallet(walletId);
          break;
      }
      setWallet(updated);
      await load();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <main>
        <p className="state-message">Loading wallet…</p>
      </main>
    );
  }

  if (error || !wallet) {
    return (
      <main>
        <div className="alert alert--error">{error ?? 'Wallet not found'}</div>
        <Link href="/wallets">
          <Button variant="ghost">Back to wallets</Button>
        </Link>
      </main>
    );
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>{wallet.label ?? wallet.assetCode}</h1>
          <p className="page-subtitle">
            {wallet.assetCode} · <span className={statusClass(wallet.status)}>{wallet.status}</span>
          </p>
        </div>
        <Link href="/wallets">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="detail-grid">
        <div className="panel">
          <h2>Balances</h2>
          {balance ? (
            <dl className="kv-list">
              <div>
                <dt>Available</dt>
                <dd>{balance.available}</dd>
              </div>
              <div>
                <dt>Pending</dt>
                <dd>{balance.pending}</dd>
              </div>
              <div>
                <dt>Locked</dt>
                <dd>{balance.locked}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{balance.total}</dd>
              </div>
            </dl>
          ) : (
            <p className="state-message">No balance data</p>
          )}
        </div>

        <div className="panel">
          <h2>Details</h2>
          <dl className="kv-list">
            <div>
              <dt>ID</dt>
              <dd className="mono">{wallet.id}</dd>
            </div>
            <div>
              <dt>Asset</dt>
              <dd>{wallet.assetCode}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(wallet.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="panel">
        <h2>Rename &amp; preferences</h2>
        <form className="form-inline" onSubmit={(e) => void handleSave(e)}>
          <label className="field">
            <span className="field-label">Label</span>
            <input
              className="field-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Alias</span>
            <input
              className="field-input"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </label>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </form>
      </section>

      <section className="panel">
        <h2>Actions</h2>
        <div className="action-row">
          {wallet.status === 'PENDING' ? (
            <Button type="button" disabled={acting} onClick={() => void runAction('activate')}>
              Activate
            </Button>
          ) : null}
          {wallet.status === 'ACTIVE' ? (
            <>
              <Button
                type="button"
                variant="secondary"
                disabled={acting}
                onClick={() => void runAction('suspend')}
              >
                Suspend
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={acting}
                onClick={() => void runAction('archive')}
              >
                Archive
              </Button>
            </>
          ) : null}
          {wallet.status === 'SUSPENDED' ? (
            <>
              <Button type="button" disabled={acting} onClick={() => void runAction('restore')}>
                Restore
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={acting}
                onClick={() => void runAction('archive')}
              >
                Archive
              </Button>
            </>
          ) : null}
          {wallet.status === 'ARCHIVED' ? (
            <Button type="button" disabled={acting} onClick={() => void runAction('restore')}>
              Restore
            </Button>
          ) : null}
        </div>
        {actionError ? <div className="alert alert--error">{actionError}</div> : null}
      </section>

      <section className="panel">
        <h2>Transactions</h2>
        {transactions.length === 0 ? (
          <p className="state-message">No transactions yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="mono">{tx.reference}</td>
                  <td>{tx.type}</td>
                  <td>{tx.status}</td>
                  <td>
                    {tx.amount} {wallet.assetCode}
                  </td>
                  <td>{new Date(tx.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
