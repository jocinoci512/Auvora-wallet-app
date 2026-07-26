'use client';

import { type ComplianceCase } from '@auvora/sdk';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminComplianceCasesPage(): ReactElement {
  const [items, setItems] = useState<ComplianceCase[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const client = createApiClient();
        const result = await client.adminListComplianceCases();
        setItems(result.items);
      } catch (err) {
        setError(formatApiError(err));
      }
    })();
  }, []);

  return (
    <main>
      <h1>Compliance cases</h1>
      <p>
        <Link href="/compliance">Back</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {items.map((c) => (
          <li key={c.id}>
            {c.reference} — {c.title} — {c.status} / {c.priority}
          </li>
        ))}
      </ul>
    </main>
  );
}
