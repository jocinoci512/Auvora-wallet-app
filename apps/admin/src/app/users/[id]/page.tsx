'use client';

import { AuvoraClientError, type UserProfile } from '@auvora/sdk';
import { Alert, AsyncStates, Button, PageHeader, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Subnav } from '../../../components/Subnav';
import { createApiClient, formatApiError } from '../../../lib/api-client';
import { IDENTITY_LINKS } from '../../../lib/section-nav';

const ROLE_OPTIONS = ['user', 'admin', 'super_admin'];
const STATUS_OPTIONS = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'];

export default function AdminUserDetailPage(): ReactElement {
  const params = useParams();
  const userId = typeof params.id === 'string' ? params.id : '';
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [roles, setRoles] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const profile = await client.adminGetUser(userId);
      setUser(profile);
      setStatus(profile.status);
      setRoles(profile.roles.length ? profile.roles : ['user']);
    } catch (err) {
      setError(
        err instanceof AuvoraClientError && err.status === 401
          ? 'Unauthorized — save an admin JWT access token above.'
          : formatApiError(err),
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(label: string, fn: () => Promise<void>, confirmMessage?: string) {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setBusy(true);
    setActionError(null);
    setActionOk(null);
    try {
      await fn();
      setActionOk(label);
      await load();
    } catch (err) {
      setActionError(formatApiError(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleRole(role: string) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  return (
    <main className="page">
      <PageHeader title="Account & permissions" subtitle={user?.email ?? userId}>
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>

      <p>
        <Link href="/users">← Back to accounts</Link>
      </p>

      {actionError ? (
        <Alert tone="error" title="Action failed">
          {actionError}
        </Alert>
      ) : null}
      {actionOk ? (
        <Alert tone="success" title="Updated">
          {actionOk}
        </Alert>
      ) : null}

      <AsyncStates
        loading={loading}
        loadingMessage="Loading account…"
        error={error}
        errorTitle="Could not load account"
        onRetry={() => void load()}
        empty={!loading && !error && !user}
        emptyTitle="Account not found"
        emptyDescription="This user id is not available."
      >
        {user ? (
          <>
            <div className="metric-grid" aria-label="Account summary">
              <div className="metric-card">
                <span className="metric-card__label">Status</span>
                <span className="metric-card__value">
                  <StatusBadge status={user.status} />
                </span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">MFA</span>
                <span className="metric-card__value">{user.mfaEnabled ? 'Enabled' : 'Off'}</span>
              </div>
              <div className="metric-card">
                <span className="metric-card__label">Email verified</span>
                <span className="metric-card__value">{user.emailVerified ? 'Yes' : 'No'}</span>
              </div>
            </div>

            <section className="panel" style={{ marginTop: '1.5rem' }} aria-label="Roles">
              <h2>RBAC roles</h2>
              <p className="page-subtitle">
                Assignments call the live auth admin API. Permissions are resolved from roles on the
                server.
              </p>
              <div className="action-row" style={{ margin: '0.75rem 0' }}>
                {ROLE_OPTIONS.map((role) => (
                  <label
                    key={role}
                    className="field"
                    style={{ flexDirection: 'row', gap: '0.4rem' }}
                  >
                    <input
                      type="checkbox"
                      checked={roles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                disabled={busy || roles.length === 0}
                onClick={() =>
                  void runAction(
                    'Roles updated',
                    async () => {
                      const client = createApiClient();
                      await client.adminAssignUserRoles(user.id, roles);
                    },
                    `Save roles [${roles.join(', ')}] for ${user.email}? Including elevated roles changes admin access.`,
                  )
                }
              >
                Save roles
              </Button>
              {user.permissions.length > 0 ? (
                <p className="page-subtitle" style={{ marginTop: '1rem' }}>
                  Effective permissions: {user.permissions.join(', ')}
                </p>
              ) : null}
            </section>

            <section className="panel" style={{ marginTop: '1.5rem' }} aria-label="Status controls">
              <h2>Account controls</h2>
              <div className="filters__row">
                <label className="field">
                  <span className="field-label">Status</span>
                  <select
                    className="field-input"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      'Status updated',
                      async () => {
                        const client = createApiClient();
                        await client.adminUpdateUserStatus(user.id, status);
                      },
                      `Change status for ${user.email} to ${status}?`,
                    )
                  }
                >
                  Update status
                </Button>
              </div>
              <div className="action-row" style={{ marginTop: '1rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      'Sessions revoked',
                      async () => {
                        const client = createApiClient();
                        await client.adminForceLogoutUser(user.id);
                      },
                      `Force logout all sessions for ${user.email}?`,
                    )
                  }
                >
                  Force logout
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      user.mfaEnabled ? 'MFA disabled' : 'MFA enabled',
                      async () => {
                        const client = createApiClient();
                        await client.adminToggleUserMfa(user.id, !user.mfaEnabled);
                      },
                      user.mfaEnabled
                        ? `Disable MFA for ${user.email}? This weakens account protection.`
                        : `Enable MFA for ${user.email}?`,
                    )
                  }
                >
                  {user.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                </Button>
              </div>
            </section>
          </>
        ) : null}
      </AsyncStates>
    </main>
  );
}
