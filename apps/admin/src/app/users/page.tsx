'use client';

import { Pagination, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { Subnav } from '../../components/Subnav';
import { RealtimeActivityFeed } from '../../components/RealtimeActivityFeed';
import type { AdminUserAccount } from '../../lib/admin-control-plane';
import { displayName, formatWhen } from '../../lib/admin-format';
import { useAdminRealtimeContext, useRealtimeRefetch } from '../../lib/admin-realtime-context';
import { createApiClient, formatAdminError } from '../../lib/api-client';
import { affectsUserDirectory } from '../../lib/realtime/admin-event';
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

const PAGE_SIZE = 25;
type SortKey = 'email' | 'status' | 'createdAt' | 'lastLoginAt';

export default function AdminUsersPage(): ReactElement {
  const [users, setUsers] = useState<AdminUserAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [applied, setApplied] = useState({ query: '', status: '', page: 1 });
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { status: realtimeStatus, events, reconnect } = useAdminRealtimeContext();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const result = await client.adminSearchUsers({
        query: applied.query.trim() || undefined,
        status: applied.status || undefined,
        skip: (applied.page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      });
      setUsers(result.users as AdminUserAccount[]);
      setTotal(result.total);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => {
    void load();
  }, [load]);
  useRealtimeRefetch(
    (event) => affectsUserDirectory(event.type),
    () => void load(),
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = useMemo(() => {
    const copy = [...users];
    copy.sort((a, b) => {
      const left = String(a[sortKey] ?? '');
      const right = String(b[sortKey] ?? '');
      return sortDir === 'asc' ? left.localeCompare(right) : right.localeCompare(left);
    });
    return copy;
  }, [users, sortKey, sortDir]);

  function toggleSort(key: SortKey): void {
    if (sortKey === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'email' ? 'asc' : 'desc');
  }

  return (
    <div className="page">
      <PageHeader
        title="Users"
        subtitle={
          loading ? 'Searching…' : `${total.toLocaleString()} account${total === 1 ? '' : 's'}`
        }
      >
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <section className="panel filters" aria-label="User filters">
        <form
          className="filters__row"
          onSubmit={(event) => {
            event.preventDefault();
            setApplied({ query, status, page: 1 });
          }}
        >
          <label className="field">
            <span className="field-label">Search</span>
            <input
              className="field-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Email or username"
              aria-label="Search users"
            />
          </label>
          <label className="field">
            <span className="field-label">Status</span>
            <select
              className="field-input"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {STATUSES.map((item) => (
                <option key={item || 'all'} value={item}>
                  {item || 'All'}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Search</Button>
        </form>
      </section>

      <AsyncStates
        loading={loading}
        loadingMessage="Loading directory…"
        error={error}
        errorTitle="Could not load users"
        onRetry={() => void load()}
        empty={!loading && !error && users.length === 0}
        emptyTitle="No accounts match"
        emptyDescription="Try clearing filters or searching by email."
      >
        <div className="table-scroll">
          <table className="data-table">
            <caption className="auvora-sr-only">User directory</caption>
            <thead>
              <tr>
                <th scope="col">
                  <button
                    type="button"
                    className="admin-sidebar__more"
                    onClick={() => toggleSort('email')}
                  >
                    User
                  </button>
                </th>
                <th scope="col">Email</th>
                <th scope="col">
                  <button
                    type="button"
                    className="admin-sidebar__more"
                    onClick={() => toggleSort('status')}
                  >
                    Status
                  </button>
                </th>
                <th scope="col">Roles</th>
                <th scope="col">Created</th>
                <th scope="col">
                  <button
                    type="button"
                    className="admin-sidebar__more"
                    onClick={() => toggleSort('lastLoginAt')}
                  >
                    Last login
                  </button>
                </th>
                <th scope="col">
                  <span className="auvora-sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{displayName(user)}</strong>
                    <div className="page-subtitle">{user.username}</div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td>{user.roles.join(', ') || '—'}</td>
                  <td>{formatWhen(user.createdAt)}</td>
                  <td>{formatWhen(user.lastLoginAt)}</td>
                  <td>
                    <Link href={`/users/${user.id}`}>Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={applied.page}
          pageCount={pageCount}
          onPageChange={(nextPage) => {
            setApplied((current) => ({ ...current, page: nextPage }));
          }}
        />
        <p className="page-subtitle">
          Server-side pagination. Column sort applies to the current page only.
        </p>
      </AsyncStates>

      <section className="admin-section">
        <RealtimeActivityFeed status={realtimeStatus} events={events} onReconnect={reconnect} />
      </section>
    </div>
  );
}
