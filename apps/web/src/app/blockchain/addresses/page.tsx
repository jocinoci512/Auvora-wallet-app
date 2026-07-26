'use client';

import {
  AuvoraClientError,
  type ChainAddress,
  type ChainNetwork,
} from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

const CHAINS = [
  'BITCOIN',
  'ETHEREUM',
  'POLYGON',
  'SOLANA',
  'BNB_SMART_CHAIN',
  'TRON',
  'LITECOIN',
] as const satisfies readonly ChainNetwork[];

function statusClass(status: ChainAddress['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

export default function BlockchainAddressesPage(): ReactElement {
  const [addresses, setAddresses] = useState<ChainAddress[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  const [chain, setChain] = useState<ChainNetwork>(CHAINS[0]);
  const [label, setLabel] = useState('');
  const [walletId, setWalletId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnauthorized(false);
    try {
      const client = createApiClient();
      const result = await client.listAddresses();
      setAddresses(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setUnauthorized(true);
        setAddresses([]);
        setTotal(0);
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

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const client = createApiClient();
      await client.createAddress({
        chain,
        label: label.trim() || undefined,
        walletId: walletId.trim() || undefined,
      });
      setLabel('');
      setWalletId('');
      await load();
    } catch (err) {
      setFormError(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Addresses</h1>
          <p className="page-subtitle">
            {total} address{total === 1 ? '' : 'es'}
          </p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="form-card">
        <h2>Create address</h2>
        <form onSubmit={(e) => void handleCreate(e)}>
          <label className="field">
            <span className="field-label">Chain</span>
            <select
              className="field-input"
              value={chain}
              onChange={(e) => setChain(e.target.value as ChainNetwork)}
              required
            >
              {CHAINS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Label</span>
            <input
              className="field-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Optional display name"
            />
          </label>

          <label className="field">
            <span className="field-label">Wallet ID</span>
            <input
              className="field-input"
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              placeholder="Optional — link to a wallet UUID"
            />
          </label>

          {formError ? <div className="alert alert--error">{formError}</div> : null}

          <div className="form-actions">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create address'}
            </Button>
          </div>
        </form>
      </section>

      {loading ? <p className="state-message">Loading addresses…</p> : null}

      {unauthorized ? (
        <div className="alert alert--warn">
          <strong>Sign in required.</strong> Save a JWT access token above, then refresh this page.
        </div>
      ) : null}

      {error ? (
        <div className="alert alert--error">
          {error}
          <Button type="button" variant="secondary" onClick={() => void load()} style={{ marginTop: '0.75rem' }}>
            Retry
          </Button>
        </div>
      ) : null}

      {!loading && !error && !unauthorized && addresses.length === 0 ? (
        <p className="state-message">No addresses yet. Create one above to get started.</p>
      ) : null}

      {!loading && addresses.length > 0 ? (
        <ul className="address-list">
          {addresses.map((address) => (
            <li key={address.id} className="address-card">
              <Link href={`/blockchain/addresses/${address.id}`} className="address-card__link">
                <div className="address-card__primary">
                  <span className="mono">{address.address}</span>
                  <span className="chain-card__symbol">
                    {address.chain.replace(/_/g, ' ')}
                    {address.label ? ` · ${address.label}` : ''}
                    {address.isPrimary ? ' · primary' : ''}
                  </span>
                </div>
                <span className={statusClass(address.status)}>{address.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
