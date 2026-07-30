'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { markPermissionsReviewed } from '../../lib/insights/demo';
import { mapPermissionGrants, web3Fetch } from '../../lib/web3/api';
import { DEMO_PERMISSIONS, riskLabel, type PermissionGrant } from '../../lib/web3/demo';
import {
  DAPP_PERMISSION_CODES,
  permissionInfoFor,
  permissionTitle,
} from '../../lib/web3/permissions';
import { sessionsFromGrants, type ConnectedAppSession } from '../../lib/web3/sessions';
import { PlatformShell } from '../platform/PlatformShell';
import { PermissionExplainList } from './PermissionExplainList';
import { TrustIndicators } from './TrustIndicators';
import { Web3SectionNav } from './Web3SectionNav';

export function PermissionCenterExperience(): ReactElement {
  const params = useSearchParams();
  const focusOrigin = params.get('origin');
  const [grants, setGrants] = useState<PermissionGrant[]>(DEMO_PERMISSIONS);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [expandedOrigin, setExpandedOrigin] = useState<string | null>(focusOrigin);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    markPermissionsReviewed();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await web3Fetch<unknown>('/api/v1/connections/dapps/permissions');
        if (cancelled) return;
        const mapped = mapPermissionGrants(data);
        if (mapped.length) {
          setGrants(mapped);
          setLive(true);
        }
      } catch (err) {
        if (!cancelled) setError(formatApiError(err));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const sessions = useMemo(() => {
    let list = sessionsFromGrants(grants);
    if (focusOrigin) list = list.filter((s) => s.origin === focusOrigin);
    return list;
  }, [grants, focusOrigin]);

  async function revoke(grant: PermissionGrant): Promise<void> {
    setBusyId(grant.id);
    setError(null);
    try {
      if (live) {
        await web3Fetch('/api/v1/connections/dapps/permissions', {
          method: 'POST',
          body: JSON.stringify({
            origin: grant.origin,
            permission: grant.permission,
            allowed: false,
          }),
        });
      }
      setGrants((prev) => prev.filter((g) => g.id !== grant.id));
      setToast(`Revoked ${permissionTitle(grant.permission)}`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 1800);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  async function disconnectSession(session: ConnectedAppSession): Promise<void> {
    setBusyId(session.id);
    setError(null);
    try {
      if (live) {
        await Promise.all(
          session.permissions.map((permission) =>
            web3Fetch('/api/v1/connections/dapps/permissions', {
              method: 'POST',
              body: JSON.stringify({
                origin: session.origin,
                permission,
                allowed: false,
              }),
            }),
          ),
        );
      }
      setGrants((prev) => prev.filter((g) => g.origin !== session.origin));
      setToast(`Disconnected ${session.name}`);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 1800);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setBusyId(null);
    }
  }

  const accounts = Array.from(new Set(grants.map((g) => g.account)));

  return (
    <PlatformShell
      title="Permissions"
      subtitle="Review connected apps, plain-language grants, and revoke access in one place."
      reassure="Revoke anything you no longer trust — transaction grants can move funds after you approve each send."
      backHref="/web3"
      backLabel="Web3 Hub"
      nav={<Web3SectionNav current="/web3/permissions" />}
      actions={
        <>
          <Link href="/settings/dapps" className="cx-btn cx-btn--ghost">
            Connected dApps
          </Link>
          <Link href="/connections" className="cx-btn cx-btn--ghost">
            Advanced lab
          </Link>
        </>
      }
    >
      {ready && !live ? (
        <Alert tone="warn" title="Preview permissions">
          Showing curated grants while the connections service is offline. Preview data is not a
          verified-safe attestation.
        </Alert>
      ) : null}
      {error && live ? (
        <Alert tone="error" title="Revoke failed">
          {error}
        </Alert>
      ) : null}
      {toast ? (
        <Alert tone="success" title="Updated">
          {toast}
        </Alert>
      ) : null}

      <div className="cx-kpi">
        <div className="cx-kpi__card">
          <span>Connected accounts</span>
          <strong>{accounts.length}</strong>
        </div>
        <div className="cx-kpi__card">
          <span>Connected apps</span>
          <strong>{sessionsFromGrants(grants).length}</strong>
        </div>
        <div className="cx-kpi__card">
          <span>Active grants</span>
          <strong>{grants.length}</strong>
        </div>
        <div className="cx-kpi__card">
          <span>Elevated</span>
          <strong>{grants.filter((g) => g.risk === 'elevated').length}</strong>
        </div>
      </div>

      <section className="cx-panel">
        <h2>Permission catalog</h2>
        <p className="cx-meta">
          Aligned with VIEW_ADDRESSES, VIEW_BALANCES, REQUEST_SIGNATURES, REQUEST_TRANSACTIONS,
          NETWORK_SWITCH, and SESSION_MANAGE.
        </p>
        <PermissionExplainList codes={[...DAPP_PERMISSION_CODES]} showCatalog />
      </section>

      <section className="cx-panel">
        <h2>Connected apps</h2>
        {sessions.length === 0 ? (
          <EmptyState
            title="No connections"
            description="Approve a dApp from the hub to see account and network permissions here."
          />
        ) : (
          <ul className="cx-list">
            {sessions.map((session) => {
              const open = expandedOrigin === session.origin;
              const sessionGrants = grants.filter((g) => g.origin === session.origin);
              return (
                <li key={session.id}>
                  <div>
                    <strong>{session.name}</strong>
                    <p className="cx-meta">
                      {session.origin} · {session.networks.join(', ')}
                    </p>
                    <p className="cx-meta">
                      {session.accounts.join(', ')} · Last{' '}
                      {new Date(session.lastActivity).toLocaleString()}
                    </p>
                    <span className="cx-badge">{riskLabel(session.risk)}</span>
                    <TrustIndicators
                      origin={session.origin}
                      permissions={session.permissions}
                      previouslyConnected
                      showRiskNotes={open}
                    />
                    {open ? (
                      <>
                        <PermissionExplainList codes={session.permissions} />
                        <ul className="cx-list" style={{ marginTop: '0.75rem' }}>
                          {sessionGrants.map((g) => {
                            const info = permissionInfoFor(g.permission);
                            return (
                              <li key={g.id}>
                                <div>
                                  <strong>{info?.title ?? g.permission}</strong>
                                  <p className="cx-meta">
                                    {g.network} · Last {new Date(g.lastActivity).toLocaleString()}
                                  </p>
                                </div>
                                <div className="cx-platform__actions">
                                  <StatusBadge
                                    status={
                                      g.risk === 'elevated'
                                        ? 'failed'
                                        : g.risk === 'medium'
                                          ? 'pending'
                                          : 'active'
                                    }
                                    label={g.permission}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="danger"
                                    disabled={busyId === g.id}
                                    onClick={() => void revoke(g)}
                                    aria-label={`Revoke ${permissionTitle(g.permission)} for ${session.name}`}
                                  >
                                    Revoke
                                  </Button>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="cx-meta">
                        {session.permissions.map(permissionTitle).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="cx-platform__actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setExpandedOrigin((cur) => (cur === session.origin ? null : session.origin))
                      }
                    >
                      {open ? 'Hide grants' : 'Manage grants'}
                    </Button>
                    <Link href={`/web3/sign?origin=${encodeURIComponent(session.origin)}`}>
                      <Button type="button" size="sm" variant="ghost">
                        Review signing
                      </Button>
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      disabled={busyId === session.id}
                      onClick={() => void disconnectSession(session)}
                      aria-label={`Disconnect ${session.name}`}
                    >
                      Disconnect
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Alert tone="info" title="Permission risk indicators">
        Signature and transaction permissions carry higher risk. Network switch grants are called
        out before approval. We never label a connection verified-safe without a catalog
        verification flag.
      </Alert>
    </PlatformShell>
  );
}
