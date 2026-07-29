'use client';

import { AuvoraClientError, type Payment, type PaymentStatistics } from '@auvora/sdk';
import { AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
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
      <PageHeader
        title="Payments"
        subtitle="Payment history, transfers, and settlement status"
        actions={
          <>
            <Link href="/payments/transfer">
              <Button>New transfer</Button>
            </Link>
            <Link href="/payments/methods">
              <Button variant="secondary">Methods</Button>
            </Link>
            <Link href="/payments/limits">
              <Button variant="secondary">Limits</Button>
            </Link>
          </>
        }
      />

      <AsyncStates
        loading={loading}
        loadingMessage="Loading payments…"
        error={error}
        errorTitle="Could not load payments"
        onRetry={() => void load()}
      >
        {stats ? (
          <div className="metric-grid" aria-label="Payment statistics">
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

        <section style={{ marginTop: '1.5rem' }}>
          <h2>Recent payments</h2>
          {payments.length === 0 ? (
            <AsyncStates
              empty
              emptyTitle="No payments yet"
              emptyDescription="Create a transfer to see activity here."
              emptyAction={
                <Link href="/payments/transfer">
                  <Button>New transfer</Button>
                </Link>
              }
            />
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <caption className="auvora-sr-only">Recent payments</caption>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Type</th>
                    <th scope="col">Status</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Created</th>
                    <th scope="col">
                      <span className="auvora-sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.reference}</td>
                      <td>{payment.type}</td>
                      <td>
                        <StatusBadge status={payment.status} />
                      </td>
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
            </div>
          )}
        </section>
      </AsyncStates>
    </main>
  );
}
