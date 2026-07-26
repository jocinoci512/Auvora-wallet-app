'use client';

import {
  AuvoraClientError,
  type CustodyKey,
  type CustodyStatusSummary,
  type SigningRequest,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';

export default function CustodyPage(): ReactElement {
  const [status, setStatus] = useState<CustodyStatusSummary | null>(null);
  const [keys, setKeys] = useState<CustodyKey[]>([]);
  const [signing, setSigning] = useState<SigningRequest[]>([]);
  const [algorithm, setAlgorithm] = useState('SECP256K1');
  const [custodyModel, setCustodyModel] = useState('HOSTED');
  const [label, setLabel] = useState('Primary');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [s, k, r] = await Promise.all([
        client.getCustodyStatus(),
        client.listCustodyKeys(),
        client.listSigningRequests(),
      ]);
      setStatus(s);
      setKeys(k.items);
      setSigning(r.items);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onGenerate(event: FormEvent): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);
    try {
      const client = createApiClient();
      await client.generateCustodyKey({ algorithm, custodyModel, label });
      setMessage('Key generated (private material never leaves custody).');
      await load();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Wallet Security</h1>
        <p>Custody keys, signing requests, and recovery.</p>
        <nav className="page__subnav">
          <Link href="/custody">Overview</Link>
          <Link href="/custody/signing">Signing</Link>
          <Link href="/custody/recovery">Recovery</Link>
          <Link href="/custody/activity">Activity</Link>
        </nav>
      </header>

      {error ? <div className="alert alert--error">{error}</div> : null}
      {message ? <div className="alert">{message}</div> : null}
      {loading ? <p>Loading…</p> : null}

      {status ? (
        <section className="stack">
          <h2>Status</h2>
          <p>
            Keys: {status.keyCount} · Pending approvals: {status.pendingApprovals} · Recoveries:{' '}
            {status.openRecoveries} · Providers: {status.activeProviders}
          </p>
        </section>
      ) : null}

      <section className="stack">
        <h2>Generate key</h2>
        <form onSubmit={onGenerate} className="stack">
          <label>
            Algorithm
            <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
              <option value="SECP256K1">secp256k1</option>
              <option value="ED25519">Ed25519</option>
              <option value="BITCOIN_SECP256K1">Bitcoin</option>
              <option value="ETHEREUM_SECP256K1">Ethereum</option>
            </select>
          </label>
          <label>
            Custody model
            <select value={custodyModel} onChange={(e) => setCustodyModel(e.target.value)}>
              <option value="SELF">Self</option>
              <option value="HOSTED">Hosted</option>
              <option value="SHARED">Shared</option>
              <option value="INSTITUTIONAL">Institutional</option>
              <option value="MPC">MPC</option>
              <option value="HSM">HSM</option>
            </select>
          </label>
          <label>
            Label
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Generating…' : 'Generate key'}
          </Button>
        </form>
      </section>

      <section className="stack">
        <h2>Keys</h2>
        <ul>
          {keys.map((key) => (
            <li key={key.id}>
              <strong>{key.label ?? key.id.slice(0, 8)}</strong> — {key.algorithm} / {key.custodyModel} /{' '}
              {key.status}
            </li>
          ))}
          {!keys.length && !loading ? <li>No keys yet.</li> : null}
        </ul>
      </section>

      <section className="stack">
        <h2>Recent signing requests</h2>
        <ul>
          {signing.slice(0, 5).map((req) => (
            <li key={req.id}>
              {req.status} · {req.requestType} · {req.amount ?? '—'} {req.asset ?? ''}
            </li>
          ))}
          {!signing.length && !loading ? <li>No signing requests.</li> : null}
        </ul>
      </section>
    </main>
  );
}
