'use client';

import { type Settlement, type SettlementBatch } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminSettlementsPage(): ReactElement {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const [s, b] = await Promise.all([
        client.adminListSettlements(),
        client.adminListSettlementBatches(),
      ]);
      setSettlements(s.items);
      setBatches(b.items);
      setError(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runManual = useCallback(async () => {
    try {
      const client = createApiClient();
      const batch = await client.adminRunSettlement({ mode: 'daily' });
      setMessage(`Started batch ${batch.reference} (${batch.status})`);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Settlements</h1>
          <p className="page-subtitle">Batches, reports, and manual settlement runs</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button type="button" onClick={() => void runManual()}>
            Run manual settlement
          </Button>
          <Link href="/payments">
            <Button variant="secondary">Dashboard</Button>
          </Link>
        </div>
      </header>
      {message ? <div className="alert alert--success">{message}</div> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}
      <h2>Batches</h2>
      <ul>
        {batches.map((batch) => (
          <li key={batch.id}>
            {batch.reference} — {batch.mode} / {batch.status} — {batch.totalAmount} {batch.currency} (
            {batch.paymentCount} payments)
          </li>
        ))}
      </ul>
      <h2>Settlements</h2>
      <ul>
        {settlements.map((item) => (
          <li key={item.id}>
            {item.reference} — {item.status} — {item.amount} {item.currency}
          </li>
        ))}
      </ul>
    </main>
  );
}
