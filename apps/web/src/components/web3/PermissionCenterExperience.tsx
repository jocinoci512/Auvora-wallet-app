'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { mapPermissionGrants, web3Fetch } from '../../lib/web3/api';
import { DEMO_PERMISSIONS, riskLabel, type PermissionGrant } from '../../lib/web3/demo';
import { PlatformShell } from '../platform/PlatformShell';
import { Web3SectionNav } from './Web3SectionNav';

export function PermissionCenterExperience(): ReactElement {
  const [grants, setGrants] = useState<PermissionGrant[]>(DEMO_PERMISSIONS);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setToast('Permission revoked');
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
      subtitle="Review connected accounts, network and signature grants, and revoke access in one place."
      reassure="Revoke anything you no longer trust — elevated signature and transaction grants deserve a second look."
      backHref="/web3"
      backLabel="Web3 Hub"
      nav={<Web3SectionNav current="/web3/permissions" />}
      actions={
        <Link href="/connections" className="cx-btn cx-btn--ghost">
          Advanced lab
        </Link>
      }
    >
      {ready && !live ? (
        <Alert tone="warn" title="Preview permissions">
          Showing curated grants while the connections service is offline.
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
          <span>Active grants</span>
          <strong>{grants.length}</strong>
        </div>
        <div className="cx-kpi__card">
          <span>Elevated</span>
          <strong>{grants.filter((g) => g.risk === 'elevated').length}</strong>
        </div>
      </div>

      <section className="cx-panel">
        <h2>Granted permissions</h2>
        {grants.length === 0 ? (
          <EmptyState
            title="No connections"
            description="Approve a dApp from the hub to see account and network permissions here."
          />
        ) : (
          <ul className="cx-list">
            {grants.map((g) => (
              <li key={g.id}>
                <div>
                  <strong>{g.origin}</strong>
                  <p className="cx-meta">
                    {g.account} · {g.network} · {g.permission}
                  </p>
                  <p className="cx-meta">
                    Last activity {new Date(g.lastActivity).toLocaleString()}
                  </p>
                  <span className="cx-badge">{riskLabel(g.risk)}</span>
                </div>
                <div className="cx-platform__actions">
                  <StatusBadge
                    status={
                      g.risk === 'elevated' ? 'failed' : g.risk === 'medium' ? 'pending' : 'active'
                    }
                    label={g.permission}
                  />
                  <Link href={`/web3/sign?origin=${encodeURIComponent(g.origin)}`}>
                    <Button type="button" size="sm" variant="secondary">
                      Edit / review
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    disabled={busyId === g.id}
                    onClick={() => void revoke(g)}
                  >
                    Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Alert tone="info" title="Permission risk indicators">
        Signature and transaction permissions carry higher risk. Network switch grants are called
        out before approval. Session persistence follows trusted-dApp rules from the connections
        service.
      </Alert>
    </PlatformShell>
  );
}
