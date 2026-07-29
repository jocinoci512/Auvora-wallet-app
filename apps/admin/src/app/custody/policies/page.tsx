'use client';

import { AuvoraClientError, type CustodyApprovalPolicy } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminPoliciesPage(): ReactElement {
  const [policies, setPolicies] = useState<CustodyApprovalPolicy[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setPolicies(await client.adminListApprovalPolicies());
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
        <h1>Policy management</h1>
        <Link href="/custody">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {policies.map((p) => (
          <li key={p.id}>
            {p.code} · {p.kind} · threshold {p.threshold} · {p.isEnabled ? 'enabled' : 'disabled'}
          </li>
        ))}
        {!policies.length ? <li>No policies.</li> : null}
      </ul>
    </main>
  );
}
