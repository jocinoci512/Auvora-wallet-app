'use client';

import type { ChainAddress, SecurityAuditLog, Wallet } from '@auvora/sdk';
import {
  Alert,
  AsyncStates,
  Button,
  EmptyState,
  PageHeader,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@auvora/ui';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ConfirmReasonDialog } from '../../../components/ConfirmReasonDialog';
import { Subnav } from '../../../components/Subnav';
import {
  adminListUserDevices,
  adminListUserSessions,
  type AdminUserAccount,
  type AdminUserDevice,
  type AdminUserSession,
} from '../../../lib/admin-control-plane';
import { displayName, formatWhen, shortId } from '../../../lib/admin-format';
import { useAdminIdentity } from '../../../lib/admin-identity';
import { canMutate, hasPermission } from '../../../lib/admin-rbac';
import { createApiClient, formatAdminError, isStepUpRequired } from '../../../lib/api-client';
import { IDENTITY_LINKS } from '../../../lib/section-nav';

const ROLE_OPTIONS = ['user', 'admin', 'super_admin'];
const STATUS_OPTIONS = ['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'LOCKED', 'DEACTIVATED'];

type PendingAction = { kind: 'roles' } | { kind: 'status' } | { kind: 'logout' } | { kind: 'mfa' };

export default function AdminUserDetailPage(): ReactElement {
  const params = useParams();
  const router = useRouter();
  const userId = typeof params.id === 'string' ? params.id : '';
  const identity = useAdminIdentity();
  const allowMutations = canMutate(identity?.operator);

  const [user, setUser] = useState<AdminUserAccount | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [addresses, setAddresses] = useState<ChainAddress[]>([]);
  const [devices, setDevices] = useState<AdminUserDevice[]>([]);
  const [sessions, setSessions] = useState<AdminUserSession[]>([]);
  const [audit, setAudit] = useState<SecurityAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionOk, setActionOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('ACTIVE');
  const [roles, setRoles] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient();
      const [profile, walletResult, addressResult, deviceRows, sessionRows, auditResult] =
        await Promise.all([
          client.adminGetUser(userId),
          client.adminListWallets({ ownerUserId: userId, take: 50 }).catch(() => ({ items: [] })),
          client.adminListAddresses({ ownerUserId: userId, take: 50 }).catch(() => ({ items: [] })),
          adminListUserDevices(userId).catch(() => []),
          adminListUserSessions(userId).catch(() => []),
          client.adminListAudit({ targetUserId: userId, take: 50 }).catch(() => ({ logs: [] })),
        ]);
      const account = profile as AdminUserAccount;
      setUser(account);
      setStatus(account.status);
      setRoles(account.roles.length ? account.roles : ['user']);
      setWallets(walletResult.items);
      setAddresses(addressResult.items);
      setDevices(deviceRows);
      setSessions(sessionRows);
      setAudit(auditResult.logs);
    } catch (err) {
      setError(formatAdminError(err));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runConfirmed(reason: string): Promise<void> {
    if (!user || !pending) return;
    setBusy(true);
    setActionError(null);
    setActionOk(null);
    try {
      const client = createApiClient();
      if (pending.kind === 'roles') {
        await client.adminAssignUserRoles(user.id, roles);
        setActionOk('Roles updated');
      } else if (pending.kind === 'status') {
        await client.adminUpdateUserStatus(user.id, status);
        setActionOk(`Status set to ${status}`);
      } else if (pending.kind === 'logout') {
        await client.adminForceLogoutUser(user.id);
        setActionOk('Sessions revoked');
      } else if (pending.kind === 'mfa') {
        await client.adminToggleUserMfa(user.id, !user.mfaEnabled);
        setActionOk(user.mfaEnabled ? 'MFA disabled' : 'MFA enabled');
      }
      void reason;
      setPending(null);
      await load();
    } catch (err) {
      if (isStepUpRequired(err)) {
        router.push(`/step-up?next=${encodeURIComponent(`/users/${user.id}`)}`);
        return;
      }
      setActionError(formatAdminError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <PageHeader title={user ? displayName(user) : 'User'} subtitle={user?.email ?? userId}>
        <Subnav label="Identity" links={IDENTITY_LINKS} />
      </PageHeader>
      <p>
        <Link href="/users">← Users directory</Link>
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
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="wallets">Wallets</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="devices">Devices</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="connections">Connections</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="audit">Admin Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <section className="admin-kpi-grid" aria-label="Account summary">
                <div className="admin-kpi">
                  <span className="admin-kpi__label">Status</span>
                  <span className="admin-kpi__value">
                    <StatusBadge status={user.status} />
                  </span>
                </div>
                <div className="admin-kpi">
                  <span className="admin-kpi__label">MFA</span>
                  <span className="admin-kpi__value">{user.mfaEnabled ? 'On' : 'Off'}</span>
                </div>
                <div className="admin-kpi">
                  <span className="admin-kpi__label">Sessions</span>
                  <span className="admin-kpi__value">
                    {user.activeSessionCount ?? sessions.filter((s) => s.active).length}
                  </span>
                </div>
                <div className="admin-kpi">
                  <span className="admin-kpi__label">Devices</span>
                  <span className="admin-kpi__value">{user.deviceCount ?? devices.length}</span>
                </div>
              </section>
              <dl className="admin-dl" style={{ marginTop: '1rem' }}>
                <dt>User ID</dt>
                <dd className="mono">{user.id}</dd>
                <dt>Platforms</dt>
                <dd>{user.platforms?.join(', ') || '—'}</dd>
                <dt>Last login</dt>
                <dd>{formatWhen(user.lastLoginAt)}</dd>
                <dt>Created</dt>
                <dd>{formatWhen(user.createdAt)}</dd>
              </dl>
            </TabsContent>

            <TabsContent value="account">
              <section className="panel">
                <h2>Identity</h2>
                <dl className="admin-dl">
                  <dt>Email</dt>
                  <dd>{user.email}</dd>
                  <dt>Username</dt>
                  <dd>{user.username}</dd>
                  <dt>Verified</dt>
                  <dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
                  <dt>Roles</dt>
                  <dd>{user.roles.join(', ') || '—'}</dd>
                </dl>
              </section>
            </TabsContent>

            <TabsContent value="wallets">
              {wallets.length === 0 ? (
                <EmptyState title="No wallets" description="This account has no wallet metadata." />
              ) : (
                <WalletTable wallets={wallets} addresses={addresses} />
              )}
            </TabsContent>

            <TabsContent value="portfolio">
              <EmptyState
                title="No Admin portfolio valuation"
                description="Admin can inspect wallet metadata and public addresses only. Private keys and seed material are never exposed."
              />
            </TabsContent>

            <TabsContent value="devices">
              <DeviceTable devices={devices} />
            </TabsContent>

            <TabsContent value="sessions">
              <SessionTable sessions={sessions} />
            </TabsContent>

            <TabsContent value="connections">
              <p className="page-subtitle">
                Connection records for this user appear on the Connections board. Secrets are never
                shown.
              </p>
              <Link href="/connections">Open connections</Link>
            </TabsContent>

            <TabsContent value="security">
              <section className="panel">
                <h2>High-risk controls</h2>
                {!allowMutations ? (
                  <p className="page-subtitle">
                    Your role is view-only. The API still enforces this.
                  </p>
                ) : null}
                <div className="filters__row">
                  {hasPermission(identity?.operator, 'roles:manage') ? (
                    <>
                      <div className="action-row">
                        {ROLE_OPTIONS.map((role) => (
                          <label
                            key={role}
                            className="field"
                            style={{ flexDirection: 'row', gap: '0.4rem' }}
                          >
                            <input
                              type="checkbox"
                              checked={roles.includes(role)}
                              onChange={() =>
                                setRoles((prev) =>
                                  prev.includes(role)
                                    ? prev.filter((item) => item !== role)
                                    : [...prev, role],
                                )
                              }
                            />
                            <span>{role}</span>
                          </label>
                        ))}
                      </div>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => setPending({ kind: 'roles' })}
                      >
                        Save roles
                      </Button>
                    </>
                  ) : null}
                </div>
                {hasPermission(identity?.operator, 'users:write') ? (
                  <div className="filters__row" style={{ marginTop: '1rem' }}>
                    <label className="field">
                      <span className="field-label">Status</span>
                      <select
                        className="field-input"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                      >
                        {STATUS_OPTIONS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => setPending({ kind: 'status' })}
                    >
                      Update status
                    </Button>
                  </div>
                ) : null}
                <div className="action-row" style={{ marginTop: '1rem' }}>
                  {hasPermission(identity?.operator, 'sessions:revoke') ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setPending({ kind: 'logout' })}
                    >
                      Revoke all sessions
                    </Button>
                  ) : null}
                  {hasPermission(identity?.operator, 'users:write') ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => setPending({ kind: 'mfa' })}
                    >
                      {user.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
                    </Button>
                  ) : null}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="activity">
              <AuditTable logs={audit} empty="No activity recorded for this user." />
            </TabsContent>

            <TabsContent value="audit">
              <AuditTable logs={audit} empty="No admin audit events target this user." />
            </TabsContent>
          </Tabs>
        ) : null}
      </AsyncStates>

      <ConfirmReasonDialog
        open={pending !== null}
        title="Confirm high-risk action"
        description="This change is audited. Enter a reason, then complete step-up if the control plane requires it."
        pending={busy}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={runConfirmed}
      />
    </div>
  );
}

function WalletTable({
  wallets,
  addresses,
}: {
  wallets: Wallet[];
  addresses: ChainAddress[];
}): ReactElement {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="auvora-sr-only">Wallet metadata</caption>
        <thead>
          <tr>
            <th scope="col">Wallet ID</th>
            <th scope="col">Network / asset</th>
            <th scope="col">Public addresses</th>
            <th scope="col">Status</th>
            <th scope="col">Created</th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((wallet) => {
            const publics = addresses.filter((row) => row.walletId === wallet.id);
            return (
              <tr key={wallet.id}>
                <td className="mono">
                  <Link href={`/wallets/${wallet.id}`}>{shortId(wallet.id, 12)}</Link>
                </td>
                <td>{wallet.assetCode}</td>
                <td className="mono">
                  {publics.length === 0 ? '—' : publics.map((row) => row.address).join(', ')}
                </td>
                <td>
                  <StatusBadge status={wallet.status} />
                </td>
                <td>{formatWhen(wallet.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DeviceTable({ devices }: { devices: AdminUserDevice[] }): ReactElement {
  if (devices.length === 0) {
    return <EmptyState title="No devices" description="This account has no registered devices." />;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="auvora-sr-only">Devices</caption>
        <thead>
          <tr>
            <th scope="col">Platform</th>
            <th scope="col">Device ID</th>
            <th scope="col">Name</th>
            <th scope="col">Last seen</th>
            <th scope="col">Created</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id}>
              <td>{device.platform || '—'}</td>
              <td className="mono">{shortId(device.id)}</td>
              <td>{device.name || '—'}</td>
              <td>{formatWhen(device.lastSeenAt)}</td>
              <td>{formatWhen(device.createdAt)}</td>
              <td>
                <StatusBadge status={device.revokedAt ? 'REVOKED' : 'ACTIVE'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionTable({ sessions }: { sessions: AdminUserSession[] }): ReactElement {
  if (sessions.length === 0) {
    return <EmptyState title="No sessions" description="This account has no recorded sessions." />;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="auvora-sr-only">Sessions</caption>
        <thead>
          <tr>
            <th scope="col">Session ID</th>
            <th scope="col">Created</th>
            <th scope="col">Expires</th>
            <th scope="col">Current</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <tr key={session.id}>
              <td className="mono">{shortId(session.id)}</td>
              <td>{formatWhen(session.createdAt)}</td>
              <td>{formatWhen(session.expiresAt)}</td>
              <td>{session.active ? 'Yes' : 'No'}</td>
              <td>
                <StatusBadge
                  status={session.revokedAt ? 'REVOKED' : session.active ? 'ACTIVE' : 'EXPIRED'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditTable({ logs, empty }: { logs: SecurityAuditLog[]; empty: string }): ReactElement {
  if (logs.length === 0) {
    return <EmptyState title="No audit results" description={empty} />;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="auvora-sr-only">Audit events</caption>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Action</th>
            <th scope="col">Actor</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{formatWhen(log.createdAt)}</td>
              <td>
                <StatusBadge status={log.action} />
              </td>
              <td className="mono">{shortId(log.actorUserId)}</td>
              <td>Recorded</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
