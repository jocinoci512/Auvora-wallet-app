'use client';

import { AuvoraClientError, type Payment } from '@auvora/sdk';
import { Alert, Button } from '@auvora/ui';
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {};
    if (!fromWalletId.trim()) next.fromWalletId = 'From wallet ID is required.';
    if (!toWalletId.trim()) next.toWalletId = 'To wallet ID is required.';
    if (fromWalletId.trim() && toWalletId.trim() && fromWalletId.trim() === toWalletId.trim()) {
      next.toWalletId = 'Destination must differ from the source wallet.';
    }
    if (!amount.trim()) next.amount = 'Amount is required.';
    else if (!/^\d+(\.\d+)?$/.test(amount.trim()) || Number(amount) <= 0) {
      next.amount = 'Enter a positive numeric amount.';
    }
    if (!currency.trim() || currency.trim().length < 3) {
      next.currency = 'Use a 3-letter currency code (e.g. USD).';
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }, [amount, currency, fromWalletId, toWalletId]);

  const onSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setError(null);
      setResult(null);
      if (!validate()) return;
      setSubmitting(true);
      try {
        const client = createApiClient();
        const payment = await client.createTransfer({
          fromWalletId: fromWalletId.trim(),
          toWalletId: toWalletId.trim(),
          amount: amount.trim(),
          currency: currency.trim().toUpperCase(),
        });
        setResult(payment);
      } catch (err) {
        setError(err instanceof AuvoraClientError ? formatApiError(err) : formatApiError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [amount, currency, fromWalletId, toWalletId, validate],
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

      <form className="form-stack" onSubmit={(event) => void onSubmit(event)} noValidate>
        <label>
          From wallet ID
          <input
            value={fromWalletId}
            onChange={(e) => setFromWalletId(e.target.value)}
            aria-invalid={Boolean(fieldErrors.fromWalletId)}
            aria-describedby={fieldErrors.fromWalletId ? 'from-wallet-error' : undefined}
            autoComplete="off"
            required
          />
          {fieldErrors.fromWalletId ? (
            <span id="from-wallet-error" className="field-error">
              {fieldErrors.fromWalletId}
            </span>
          ) : null}
        </label>
        <label>
          To wallet ID
          <input
            value={toWalletId}
            onChange={(e) => setToWalletId(e.target.value)}
            aria-invalid={Boolean(fieldErrors.toWalletId)}
            aria-describedby={fieldErrors.toWalletId ? 'to-wallet-error' : undefined}
            autoComplete="off"
            required
          />
          {fieldErrors.toWalletId ? (
            <span id="to-wallet-error" className="field-error">
              {fieldErrors.toWalletId}
            </span>
          ) : null}
        </label>
        <label>
          Amount
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-invalid={Boolean(fieldErrors.amount)}
            aria-describedby={fieldErrors.amount ? 'amount-error' : undefined}
            required
          />
          {fieldErrors.amount ? (
            <span id="amount-error" className="field-error">
              {fieldErrors.amount}
            </span>
          ) : null}
        </label>
        <label>
          Currency
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={8}
            aria-invalid={Boolean(fieldErrors.currency)}
            aria-describedby={fieldErrors.currency ? 'currency-error' : undefined}
            required
          />
          {fieldErrors.currency ? (
            <span id="currency-error" className="field-error">
              {fieldErrors.currency}
            </span>
          ) : null}
        </label>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Create transfer'}
        </Button>
      </form>

      {error ? (
        <Alert tone="error" title="Transfer failed">
          {error}
        </Alert>
      ) : null}
      {result ? (
        <Alert tone="success" title="Transfer created">
          Created {result.reference} — status {result.status}.{' '}
          <Link href={`/payments/${result.id}`}>Open receipt</Link>
        </Alert>
      ) : null}
    </main>
  );
}
