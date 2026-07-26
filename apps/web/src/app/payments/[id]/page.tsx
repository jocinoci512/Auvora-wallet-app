'use client';

import { AuvoraClientError, type Payment, type PaymentReceipt } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function PaymentDetailPage(): ReactElement {
  const params = useParams<{ id: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const [p, r] = await Promise.all([
        client.getPayment(params.id),
        client.getPaymentReceipt(params.id),
      ]);
      setPayment(p);
      setReceipt(r);
    } catch (err) {
      setError(err instanceof AuvoraClientError ? formatApiError(err) : formatApiError(err));
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadReceipt = useCallback(() => {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `receipt-${receipt.reference}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [receipt]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Payment detail</h1>
          <p className="page-subtitle">Status, settlement, and receipt</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Back</Button>
        </Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {payment ? (
        <section>
          <p>
            <strong>{payment.reference}</strong> — {payment.type} / {payment.status}
          </p>
          <p>
            Amount: {payment.amount} {payment.currency} (fee {payment.feeAmount})
          </p>
          <p>Settled: {payment.settledAt ? new Date(payment.settledAt).toLocaleString() : '—'}</p>
          <p>Completed: {payment.completedAt ? new Date(payment.completedAt).toLocaleString() : '—'}</p>
          <Button type="button" onClick={downloadReceipt}>
            Download receipt (JSON)
          </Button>
        </section>
      ) : null}
    </main>
  );
}
