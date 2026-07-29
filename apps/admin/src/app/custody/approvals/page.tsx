'use client';

import { AuvoraClientError, type ApprovalQueueItem } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminApprovalsPage(): ReactElement {
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      const result = await client.adminCustodyApprovalQueue();
      setItems(result.items);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Approval queue</h1>
        <Link href="/custody">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {items.map((a) => (
          <li key={a.id}>
            {a.status} · request {a.signingRequestId.slice(0, 8)}… · {a.createdAt}
          </li>
        ))}
        {!items.length ? <li>No pending approvals.</li> : null}
      </ul>
    </main>
  );
}
