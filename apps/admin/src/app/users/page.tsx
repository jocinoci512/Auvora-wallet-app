'use client';

import { AuvoraClientError, type UserProfile } from '@auvora/sdk';
import { AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { IDENTITY_LINKS } from '../../lib/section-nav';

const STATUSES = [
  '',
  'PENDING_VERIFICATION',
  'ACTIVE',
  'SUSPENDED',
  'LOCKED',
  'DEACTIVATED',
  'DELETED',
];

export default function AdminUsersPage(): ReactElement {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState({ query: '', status: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminSearchUsers({
        query: applied.query.trim() || undefined,
        status: applied.status || undefined,
        take: 50,
      });
      setUsers(result.users);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);

  function runSearch(): void {
    setApplied({ query, status });
  }

  return (
    <main className="page">
      <PageHeader
        title="Admin accounts"
        subtitle={loading ? 'Searching…' : `${total} account${total === 1 ? '' : 's'}`}
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <section className="panel filters" aria-label="User filters">
        <div className="filters__row">
          <label className="field">
            <span className="field-label">Search</span>
            <input
              className="field-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Email or username"
            />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s || 'All'}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={runSearch}>
            Search
          </Button>
        </div>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading accounts…"
        error={error}
        errorTitle="Could not load users"
        onRetry={() => void load()}
        empty={!loading && !error && users.length === 0}
        emptyTitle="No accounts match"
        emptyDescription="Try clearing filters or searching by email."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">Admin user search results</caption>
            <thead>
              <tr>
                <th scope="col">Email</th>
                <th scope="col">Username</th>
                <th scope="col">Status</th>
                <th scope="col">Roles</th>
                <th scope="col">MFA</th>
                <th scope="col">
                  <span className="auvora-sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.username}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td>{user.roles.join(', ') || '—'}</td>
                  <td>{user.mfaEnabled ? 'On' : 'Off'}</td>
                  <td>
                    <Link href={`/users/${user.id}`}>Manage</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AsyncStates>
    </main>
  );
}
