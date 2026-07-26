'use client';

import {
  AuvoraClientError,
  type Payment,
  type PaymentStatistics,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function PaymentsPage(): ReactElement {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [stats, setStats] = useState<PaymentStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [list, statistics] = await Promise.all([
        client.searchPayments({ take: 20 }),
        client.getPaymentStatistics(),
      ]);
      setPayments(list.items);
      setStats(statistics);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
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
          <h1>Payments</h1>
          <p className="page-subtitle">Payment history, transfers, and settlement status</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/payments/transfer">
            <Button>New transfer</Button>
          </Link>
          <Link href="/payments/methods">
            <Button variant="secondary">Methods</Button>
          </Link>
          <Link href="/payments/limits">
            <Button variant="secondary">Limits</Button>
          </Link>
        </div>
      </header>

      {loading ? <p className="state-message">Loading payments…</p> : null}

      {error ? (
        <div className="alert alert--error">
          {error}
          <Button type="button" variant="secondary" onClick={() => void load()} style={{ marginTop: '0.75rem' }}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error && stats ? (
        <div className="metric-grid">
          <div className="metric-card">
            <span className="metric-card__label">Total</span>
            <span className="metric-card__value">{stats.totalPayments}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Completed</span>
            <span className="metric-card__value">{stats.totalCompleted}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Pending</span>
            <span className="metric-card__value">{stats.totalPending}</span>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Failed</span>
            <span className="metric-card__value">{stats.totalFailed}</span>
          </div>
        </div>
      ) : null}

      {!loading && !error ? (
        <section style={{ marginTop: '1.5rem' }}>
          <h2>Recent payments</h2>
          {payments.length === 0 ? (
            <p className="state-message">No payments yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.reference}</td>
                    <td>{payment.type}</td>
                    <td>{payment.status}</td>
                    <td>
                      {payment.amount} {payment.currency}
                    </td>
                    <td>{new Date(payment.createdAt).toLocaleString()}</td>
                    <td>
                      <Link href={`/payments/${payment.id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </main>
  );
}
