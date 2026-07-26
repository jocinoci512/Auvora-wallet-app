'use client';

import { AuvoraClientError, type SigningRequest } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function CustodySigningPage(): ReactElement {
  const [items, setItems] = useState<SigningRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.listSigningRequests();
      setItems(result.items);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, approve: boolean): Promise<void> {
    setMessage(null);
    setError(null);
    try {
      const client = createApiClient();
      if (approve) {
        await client.approveSigningRequest(id);
        setMessage('Approved.');
      } else {
        await client.rejectSigningRequest(id);
        setMessage('Rejected.');
      }
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Signing requests</h1>
        <Link href="/custody">← Custody</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert">{message}</div> : null}
      <ul className="stack">
        {items.map((req) => (
          <li key={req.id}>
            <div>
              <strong>{req.status}</strong> · {req.requestType} · {req.destination ?? 'n/a'} ·{' '}
              {req.amount ?? '—'} {req.asset ?? ''}
            </div>
            {req.status === 'AWAITING_APPROVAL' || req.status === 'PENDING' ? (
              <div className="row">
                <Button type="button" onClick={() => void decide(req.id, true)}>
                  Approve
                </Button>
                <Button type="button" onClick={() => void decide(req.id, false)}>
                  Reject
                </Button>
              </div>
            ) : null}
          </li>
        ))}
        {!items.length ? <li>No signing requests.</li> : null}
      </ul>
    </main>
  );
}
