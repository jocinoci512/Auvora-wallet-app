'use client';

import { AuvoraClientError, type ChainTransaction, type ChainTxStatus } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

function statusClass(status: ChainTransaction['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

type FilterPreset = 'all' | 'pending' | 'failed';

const PRESET_STATUSES: Record<FilterPreset, ChainTxStatus | undefined> = {
  all: undefined,
  pending: 'PENDING',
  failed: 'FAILED',
};

export default function AdminBlockchainTransactionsPage(): ReactElement {
  const [transactions, setTransactions] = useState<ChainTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [preset, setPreset] = useState<FilterPreset>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListChainTransactions({ status: PRESET_STATUSES[preset] });
      setTransactions(result.items);
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
  }, [preset]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="page-subtitle">
            {total} transaction{total === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="panel filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Filter</span>
            <select
              className="field-input"
              value={preset}
              onChange={(e) => setPreset(e.target.value as FilterPreset)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? <p className="state-message">Loading transactions…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!loading && !error && transactions.length === 0 ? (
        <p className="state-message">No transactions match this filter.</p>
      ) : null}

      {!loading && transactions.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tx hash</th>
              <th>Chain</th>
              <th>Direction</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Confirmations</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="mono">{tx.txHash.slice(0, 14)}…</td>
                <td>{tx.chain.replace(/_/g, ' ')}</td>
                <td>{tx.direction}</td>
                <td>
                  <span className={statusClass(tx.status)}>{tx.status}</span>
                </td>
                <td>{tx.amount}</td>
                <td>
                  {tx.confirmations}/{tx.requiredConfirmations}
                </td>
                <td>{new Date(tx.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
