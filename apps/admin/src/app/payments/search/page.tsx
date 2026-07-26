'use client';

import { type Payment } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminPaymentSearchPage(): ReactElement {
  const [items, setItems] = useState<Payment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminSearchPayments({ take: 50 });
      setItems(result.items);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Payment search</h1>
          <p className="page-subtitle">Search and inspect orchestrated payments</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>User</th>
            <th>Type</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Risk flags</th>
          </tr>
        </thead>
        <tbody>
          {items.map((payment) => (
            <tr key={payment.id}>
              <td>{payment.reference}</td>
              <td>{payment.ownerUserId.slice(0, 8)}…</td>
              <td>{payment.type}</td>
              <td>{payment.status}</td>
              <td>
                {payment.amount} {payment.currency}
              </td>
              <td>{payment.riskFlags.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
