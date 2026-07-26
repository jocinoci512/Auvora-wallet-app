'use client';

import { AuvoraClientError, type RecoveryContact } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

export default function CustodyRecoveryPage(): ReactElement {
  const [contacts, setContacts] = useState<RecoveryContact[]>([]);
  const [policyId, setPolicyId] = useState('');
  const [label, setLabel] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const client = createApiClient();
      setContacts(await client.listRecoveryContacts());
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

  async function onAdd(event: FormEvent): Promise<void> {
    event.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const client = createApiClient();
      await client.addRecoveryContact({ policyId, label, email: email || undefined });
      setMessage('Recovery contact added.');
      setLabel('');
      setEmail('');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Recovery contacts</h1>
        <Link href="/custody">← Custody</Link>
      </header>
      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert">{message}</div> : null}
      <form onSubmit={onAdd} className="stack">
        <label>
          Policy ID
          <input value={policyId} onChange={(e) => setPolicyId(e.target.value)} required />
        </label>
        <label>
          Label
          <input value={label} onChange={(e) => setLabel(e.target.value)} required />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <Button type="submit">Add contact</Button>
      </form>
      <ul>
        {contacts.map((c) => (
          <li key={c.id}>
            {c.label} · policy {c.policyId.slice(0, 8)}…
          </li>
        ))}
        {!contacts.length ? <li>No recovery contacts.</li> : null}
      </ul>
    </main>
  );
}
