'use client';

import { AuvoraClientError, type PaymentMethod } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function PaymentMethodsPage(): ReactElement {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [label, setLabel] = useState('Primary card');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.listPaymentMethods();
      setMethods(result.items);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      try {
        const client = createApiClient();
        await client.createPaymentMethod({ type: 'CARD', label, last4: '4242', currency: 'USD' });
        await load();
      } catch (err) {
        setError(err instanceof AuvoraClientError ? formatApiError(err) : formatApiError(err));
      }
    },
    [label, load],
  );

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Payment methods</h1>
          <p className="page-subtitle">Manage saved deposit and payout methods</p>
        </div>
        <Link href="/payments">
          <Button variant="secondary">Back</Button>
        </Link>
      </header>

      <form className="form-stack" onSubmit={(event) => void onCreate(event)}>
        <label>
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <Button type="submit">Add card method</Button>
      </form>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {loading ? <p className="state-message">Loading…</p> : null}
      {!loading ? (
        <ul>
          {methods.map((method) => (
            <li key={method.id}>
              {method.label ?? method.type} {method.last4 ? `•••• ${method.last4}` : ''} —{' '}
              {method.isActive ? 'active' : 'inactive'}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
