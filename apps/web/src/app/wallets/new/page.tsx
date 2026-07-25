'use client';

import { AuvoraClientError } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

const ASSET_CODES = ['BTC', 'ETH', 'MATIC', 'SOL', 'BNB', 'TRX', 'LTC'] as const;

export default function NewWalletPage(): ReactElement {
  const router = useRouter();
  const [assetCode, setAssetCode] = useState<string>(ASSET_CODES[0]);
  const [alias, setAlias] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const client = createApiClient();
      const wallet = await client.createWallet({
        assetCode,
        alias: alias.trim() || undefined,
        label: label.trim() || undefined,
      });
      router.push(`/wallets/${wallet.id}`);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save a JWT access token above before creating a wallet.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Create wallet</h1>
          <p className="page-subtitle">Choose an asset and optional display fields.</p>
        </div>
        <Link href="/wallets">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <form className="form-card" onSubmit={(e) => void handleSubmit(e)}>
        <label className="field">
          <span className="field-label">Asset</span>
          <select
            className="field-input"
            value={assetCode}
            onChange={(e) => setAssetCode(e.target.value)}
            required
          >
            {ASSET_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field-label">Alias</span>
          <input
            className="field-input"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Optional unique alias"
          />
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

        {error ? <div className="alert alert--error">{error}</div> : null}

        <div className="form-actions">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create wallet'}
          </Button>
        </div>
      </form>
    </main>
  );
}
