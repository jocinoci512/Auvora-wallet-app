'use client';

import { AuvoraClientError, type SignerGroup } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminSignersPage(): ReactElement {
  const [groups, setGroups] = useState<SignerGroup[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setGroups(await client.adminListSignerGroups());
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
        <h1>Signer groups</h1>
        <Link href="/custody">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <ul>
        {groups.map((g) => (
          <li key={g.id}>
            {g.name} · {g.threshold}-of-{g.totalSigners} · {g.isEnabled ? 'on' : 'off'}
          </li>
        ))}
        {!groups.length ? <li>No signer groups.</li> : null}
      </ul>
    </main>
  );
}
