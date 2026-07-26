'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminHealthPage(): ReactElement {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setData(await client.adminObservabilityHealth());
    } catch (err) {
      setError(formatApiError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="page">
      <header className="page__header">
        <h1>Provider / Service Health</h1>
        <nav className="page__subnav">
          <Link href="/observability">Dashboard</Link>
        </nav>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {data ? <pre className="code-block">{JSON.stringify(data, null, 2)}</pre> : null}
    </main>
  );
}
