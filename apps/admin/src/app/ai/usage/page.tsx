'use client';

import { AuvoraClientError, type AiUsageMetrics } from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminAiUsagePage(): ReactElement {
  const [usage, setUsage] = useState<AiUsageMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient();
      setUsage(await client.adminAiUsage());
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
        <h1>Usage & cost</h1>
        <Link href="/ai">← Dashboard</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {usage ? (
        <>
          <p>
            Period {usage.period} · Requests {usage.totalRequests} · Tokens {usage.totalTokens} ·
            Cost ${usage.totalCost.toFixed(2)}
          </p>
          <section className="stack">
            <h2>By provider</h2>
            <ul>
              {Object.entries(usage.byProvider).map(([provider, tokens]) => (
                <li key={provider}>
                  {provider} · {tokens} tokens
                </li>
              ))}
              {!Object.keys(usage.byProvider).length ? <li>No provider breakdown.</li> : null}
            </ul>
          </section>
        </>
      ) : null}
    </main>
  );
}
