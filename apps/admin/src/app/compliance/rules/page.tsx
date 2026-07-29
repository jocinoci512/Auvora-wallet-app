'use client';

import { type ComplianceRule } from '@auvora/sdk';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminComplianceRulesPage(): ReactElement {
  const [items, setItems] = useState<ComplianceRule[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const client = createApiClient();
        setItems(await client.adminListComplianceRules());
      } catch (err) {
        setError(formatApiError(err));
      }
    })();
  }, []);

  return (
    <main>
      <h1>Compliance rules</h1>
      <p>
        <Link href="/compliance">Back</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            {r.code} — {r.name} — {r.action} (priority {r.priority}){' '}
            {r.isEnabled ? '' : '[disabled]'}
          </li>
        ))}
      </ul>
    </main>
  );
}
