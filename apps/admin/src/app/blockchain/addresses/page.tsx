'use client';

import { AuvoraClientError, type ChainAddress, type ChainAddressStatus } from '@auvora/sdk';
import { Button } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../../lib/api-client';

const STATUSES: Array<ChainAddressStatus | ''> = ['', 'PENDING', 'ACTIVE', 'ARCHIVED'];

function statusClass(status: ChainAddress['status']): string {
  return `status-badge status-badge--${status.toLowerCase()}`;
}

export default function AdminBlockchainAddressesPage(): ReactElement {
  const [addresses, setAddresses] = useState<ChainAddress[]>([]);
  const [total, setTotal] = useState(0);
  const [ownerUserId, setOwnerUserId] = useState('');
  const [status, setStatus] = useState<ChainAddressStatus | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminListAddresses({
        ownerUserId: ownerUserId.trim() || undefined,
        status: status || undefined,
      });
      setAddresses(result.items);
      setTotal(result.total);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setError('Unauthorized — save an admin JWT access token above.');
      } else {
        setError(formatApiError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [ownerUserId, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main>
      <header className="page-header">
        <div>
          <h1>Addresses</h1>
          <p className="page-subtitle">
            {total} address{total === 1 ? '' : 'es'} found
          </p>
        </div>
        <Link href="/blockchain">
          <Button variant="ghost">Back</Button>
        </Link>
      </header>

      <section className="panel filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Owner user ID</span>
            <input
              className="field-input"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value)}
              placeholder="UUID"
            />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as ChainAddressStatus | '')}
            >
              {STATUSES.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s || 'All'}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={() => void load()}>
            Search
          </Button>
        </div>
      </section>

      {loading ? <p className="state-message">Loading addresses…</p> : null}
      {error ? <div className="alert alert--error">{error}</div> : null}

      {!loading && !error && addresses.length === 0 ? (
        <p className="state-message">No addresses match your filters.</p>
      ) : null}

      {!loading && addresses.length > 0 ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Chain</th>
              <th>Address</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {addresses.map((address) => (
              <tr key={address.id}>
                <td>{address.chain.replace(/_/g, ' ')}</td>
                <td className="mono">{address.address}</td>
                <td className="mono">{address.ownerUserId.slice(0, 8)}…</td>
                <td>
                  <span className={statusClass(address.status)}>{address.status}</span>
                </td>
                <td>{new Date(address.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
