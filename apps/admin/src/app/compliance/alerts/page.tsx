'use client';

import { type AmlAlert } from '@auvora/sdk';
import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function AdminComplianceAlertsPage(): ReactElement {
  const [items, setItems] = useState<AmlAlert[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const client = createApiClient();
        const result = await client.adminListComplianceAlerts();
        setItems(result.items);
      } catch (err) {
        setError(formatApiError(err));
      }
    })();
  }, []);

  return (
    <main>
      <h1>AML alerts</h1>
      <p>
        <Link href="/compliance">Back</Link>
      </p>
      {error ? <p role="alert">{error}</p> : null}
      <ul>
        {items.map((a) => (
          <li key={a.id}>
            [{a.severity}] {a.title} — {a.status} ({a.ruleCode})
          </li>
        ))}
      </ul>
    </main>
  );
}
