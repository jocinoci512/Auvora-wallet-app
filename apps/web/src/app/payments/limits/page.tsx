'use client';

import { type PaymentLimit } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function PaymentLimitsPage(): ReactElement {
  const [limits, setLimits] = useState<PaymentLimit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      setLimits(await client.listPaymentLimits());
    } catch (err) {
      setError(formatApiError(err));
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
          <h1>Payment limits</h1>
          <p className="page-subtitle">Configured transaction and period limits</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Back</Button>
        </Link>
      </header>
      {loading ? <p className="state-message">Loading…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}
      {!loading && !error ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Window</th>
              <th>Amount</th>
              <th>Currency</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {limits.map((limit) => (
              <tr key={limit.id}>
                <td>{limit.window}</td>
                <td>{limit.amount}</td>
                <td>{limit.currency ?? '—'}</td>
                <td>{limit.accountTier ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
