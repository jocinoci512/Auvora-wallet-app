'use client';

import { type ReconciliationRecord } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminReconciliationPage(): ReactElement {
  const [items, setItems] = useState<ReconciliationRecord[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await createApiClient().adminListReconciliation();
      setItems(result.items);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(async () => {
    try {
      const result = await createApiClient().adminRunReconciliation();
      setMessage(`Processed ${result.processed} records (${result.mismatches} mismatches)`);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Reconciliation</h1>
          <p className="page-subtitle">Exception and manual review queue</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button type="button" onClick={() => void run()}>
            Run reconciliation
          </Button>
          <Link href="/payments">
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </header>
      {message ? <div className="alert alert--success">{message}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.status} — {item.source} — expected {item.expectedAmount ?? '—'} / actual{' '}
            {item.actualAmount ?? '—'} {item.currency ?? ''}
            {item.requiresManualReview ? ' (manual review)' : ''}
          </li>
        ))}
      </ul>
    </main>
  );
}
