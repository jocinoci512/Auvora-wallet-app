'use client';

import {
  AuvoraClientError,
  type ChainAddress,
  type ChainBalance,
  type ChainTransaction,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../../lib/api-client';

function statusClass(status: ChainAddress['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

export default function BlockchainAddressDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const addressId = params.id;

  const [address, setAddress] = useState<ChainAddress | null>(null);
  const [balance, setBalance] = useState<ChainBalance | null>(null);
  const [transactions, setTransactions] = useState<ChainTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const addressData = await client.getAddress(addressId);
      setAddress(addressData);
      const [balanceData, txData] = await Promise.all([
        client.getChainBalance(addressId).catch(() => null),
        client.listChainTransactions({ addressId }).catch(() => ({ items: [], total: 0 })),
      ]);
      setBalance(balanceData);
      setTransactions(txData.items);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [addressId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyAddress(): Promise<void> {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.address);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access may be denied; no-op.
    }
  }

  async function runAction(action: 'activate' | 'archive' | 'set-primary'): Promise<void> {
    setActing(true);
    setActionError(null);
    try {
      const client = createApiClient();
      let updated: ChainAddress;
      switch (action) {
        case 'activate':
          updated = await client.activateAddress(addressId);
          break;
        case 'archive':
          updated = await client.archiveAddress(addressId);
          break;
        case 'set-primary':
          updated = await client.setPrimaryAddress(addressId);
          break;
      }
      setAddress(updated);
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
        <p className="state-message">Loading address…</p>
      </main>
    );
  }

  if (error || !address) {
    return (
      <main>
        <div className="alert alert--error">{error ?? 'Address not found'}</div>
        <Link href="/blockchain/addresses">
          <Button variant="ghost">Back to addresses</Button>
        </Link>
      </main>
    );
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>{address.label ?? address.chain.replace(/_/g, ' ')}</h1>
          <p className="page-subtitle">
            {address.chain.replace(/_/g, ' ')} ·{' '}
            <span className={statusClass(address.status)}>{address.status}</span>
            {address.isPrimary ? <span className="tag" style={{ marginLeft: '0.5rem' }}>Primary</span> : null}
          </p>
        </div>
        <Link href="/blockchain/addresses">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="panel">
        <h2>Address</h2>
        <div className="copy-row">
          <span className="mono">{address.address}</span>
          <Button type="button" variant="secondary" onClick={() => void copyAddress()}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </section>

      <section className="detail-grid">
        <div className="panel">
          <h2>Balance</h2>
          {balance ? (
            <dl className="kv-list">
              <div>
                <dt>Confirmed</dt>
                <dd>{balance.confirmed}</dd>
              </div>
              <div>
                <dt>Unconfirmed</dt>
                <dd>{balance.unconfirmed}</dd>
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
              <dd className="mono">{address.id}</dd>
            </div>
            <div>
              <dt>Watched</dt>
              <dd>{address.watched ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(address.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="panel">
        <h2>Actions</h2>
        <div className="action-row">
          {address.status === 'PENDING' ? (
            <Button type="button" disabled={acting} onClick={() => void runAction('activate')}>
              Activate
            </Button>
          ) : null}
          {address.status !== 'ARCHIVED' ? (
            <Button type="button" variant="ghost" disabled={acting} onClick={() => void runAction('archive')}>
              Archive
            </Button>
          ) : null}
          {!address.isPrimary && address.status === 'ACTIVE' ? (
            <Button type="button" variant="secondary" disabled={acting} onClick={() => void runAction('set-primary')}>
              Set as primary
            </Button>
          ) : null}
        </div>
        {actionError ? <div className="alert alert--error">{actionError}</div> : null}
      </section>

      <section className="panel">
        <h2>Recent transactions</h2>
        {transactions.length === 0 ? (
          <p className="state-message">No transactions yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tx hash</th>
                <th>Direction</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Confirmations</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="mono">{tx.txHash.slice(0, 14)}…</td>
                  <td>{tx.direction}</td>
                  <td>{tx.status}</td>
                  <td>{tx.amount}</td>
                  <td>
                    {tx.confirmations}/{tx.requiredConfirmations}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
