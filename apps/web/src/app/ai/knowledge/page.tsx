'use client';

import { AuvoraClientError, type AiKnowledgeSearchResult } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AiKnowledgePage(): ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AiKnowledgeSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSearch(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.searchAiKnowledge(query);
      setResults(result.items);
      setSearched(true);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save a JWT access token above.'
          : formatApiError(err),
      );
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Knowledge search</h1>
        <Link href="/ai">← Chat</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      <form onSubmit={onSearch} className="stack">
        <label>
          Search
          <input value={query} onChange={(e) => setQuery(e.target.value)} required />
        </label>
        <Button type="submit">Search</Button>
      </form>
      <ul className="stack">
        {results.map((r) => (
          <li key={r.id}>
            <strong>{r.title}</strong> · score {r.score.toFixed(2)}
            <div>{r.snippet}</div>
          </li>
        ))}
        {searched && !results.length ? <li>No results.</li> : null}
      </ul>
    </main>
  );
}
