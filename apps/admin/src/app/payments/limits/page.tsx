'use client';

import { type PaymentLimit } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminPaymentLimitsPage(): ReactElement {
  const [items, setItems] = useState<PaymentLimit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await createApiClient().adminListPaymentLimits());
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
          <h1>Payment limits</h1>
          <p className="page-subtitle">Configurable limits and risk-profile scopes</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Dashboard</Button>
        </Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <table className="data-table">
        <thead>
          <tr>
            <th>Window</th>
            <th>Amount</th>
            <th>Currency</th>
            <th>Tier</th>
            <th>Country</th>
            <th>Risk</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {items.map((limit) => (
            <tr key={limit.id}>
              <td>{limit.window}</td>
              <td>{limit.amount}</td>
              <td>{limit.currency ?? '—'}</td>
              <td>{limit.accountTier ?? '—'}</td>
              <td>{limit.country ?? '—'}</td>
              <td>{limit.riskProfile ?? '—'}</td>
              <td>{limit.isEnabled ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
