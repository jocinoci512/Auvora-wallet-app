'use client';

import { AuvoraClientError, type ChainAddress, type ChainTransaction } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function BlockchainTransactionsPage(): ReactElement {
  const [transactions, setTransactions] = useState<ChainTransaction[]>([]);
  const [addresses, setAddresses] = useState<ChainAddress[]>([]);
  const [addressId, setAddressId] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);
    setUnsupported(false);
    try {
      const client = createApiClient();
      const addressList = await client.listAddresses().catch(() => ({ items: [], total: 0 }));
      setAddresses(addressList.items);
      const result = await client.listChainTransactions(addressId ? { addressId } : {});
      setTransactions(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setUnauthorized(true);
        setTransactions([]);
        setTotal(0);
      } else if (err instanceof AuvoraClientError && (err.status === 404 || err.status === 501)) {
        setUnsupported(true);
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

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Transactions</h1>
          <p className="page-subtitle">
            {total} transaction{total === 1 ? '' : 's'} across your chain addresses
          </p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      {addresses.length > 0 ? (
        <section className="panel filters">
          <div className="filters__row">
            <label className="field">
              <span className="field-label">Filter by address</span>
              <select
                className="field-input"
                value={addressId}
                onChange={(e) => setAddressId(e.target.value)}
              >
                <option value="">All addresses</option>
                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ?? a.address} ({a.chain.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {loading ? <p className="state-message">Loading transactions…</p> : null}

      {unauthorized ? (
        <div className="alert alert--warn">
          <strong>Sign in required.</strong> Save a JWT access token above, then refresh this page.
        </div>
      ) : null}

      {unsupported ? (
        <p className="state-message">
          The blockchain service does not yet support listing transactions for this filter.
        </p>
      ) : null}

      {error ? (
        <div className="alert alert--error">
          {error}
          <Button
            type="button"
            variant="secondary"
            onClick={() => void load()}
            style={{ marginTop: '0.75rem' }}
          >
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error && !unauthorized && !unsupported && transactions.length === 0 ? (
        <p className="state-message">No transactions found for your addresses yet.</p>
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
                <td>{tx.status}</td>
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
