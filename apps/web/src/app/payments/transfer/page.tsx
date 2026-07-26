'use client';

import { AuvoraClientError, type Payment } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function TransferPage(): ReactElement {
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [result, setResult] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setSubmitting(true);
      setError(null);
      setResult(null);
      try {
        const client = createApiClient();
        const payment = await client.createTransfer({
          fromWalletId,
          toWalletId,
          amount,
          currency,
        });
        setResult(payment);
      } catch (err) {
        setError(err instanceof AuvoraClientError ? formatApiError(err) : formatApiError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [amount, currency, fromWalletId, toWalletId],
  );

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Create transfer</h1>
          <p className="page-subtitle">Wallet-to-wallet payment via the orchestration platform</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Back</Button>
        </Link>
      </header>

      <form className="form-stack" onSubmit={(event) => void onSubmit(event)}>
        <label>
          From wallet ID
          <input value={fromWalletId} onChange={(e) => setFromWalletId(e.target.value)} required />
        </label>
        <label>
          To wallet ID
          <input value={toWalletId} onChange={(e) => setToWalletId(e.target.value)} required />
        </label>
        <label>
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <label>
          Currency
          <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Create transfer'}
        </Button>
      </form>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {result ? (
        <div className="alert alert--success">
          Created {result.reference} — status {result.status}.{' '}
          <Link href={`/payments/${result.id}`}>Open receipt</Link>
        </div>
      ) : null}
    </main>
  );
}
