'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useDeferredValue, useEffect, useMemo, useState, type ReactElement } from 'react';
import { mapPermissionGrants, web3Fetch } from '../../lib/web3/api';
import { DEMO_PERMISSIONS, riskLabel, type PermissionGrant } from '../../lib/web3/demo';
import {
  demoConnectedRows,
  sessionToRow,
  sessionsFromGrants,
  type ConnectedDappRow,
} from '../../lib/web3/sessions';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

type SortKey = 'name' | 'activity' | 'permissions';

const SORT_KEYS: SortKey[] = ['name', 'activity', 'permissions'];

/**
 * Settings surface for connected dApps — composes the same grant/session model as
 * `/web3/permissions` rather than maintaining a forked demo list.
 */
export function ConnectedDappsSettingsExperience(): ReactElement {
  const [grants, setGrants] = useState<PermissionGrant[]>(DEMO_PERMISSIONS);
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [network, setNetwork] = useState('all');
  const [sort, setSort] = useState<SortKey>('activity');
  const [disconnected, setDisconnected] = useState<string[]>([]);
  const { toast, showToast } = useTimedToast(2400);

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
      } catch {
        /* preview fallback */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows: ConnectedDappRow[] = useMemo(() => {
    const mapped = grants.length
      ? sessionsFromGrants(grants).map(sessionToRow)
      : demoConnectedRows();
    return mapped.filter((r) => !disconnected.includes(r.id));
  }, [grants, disconnected]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (network !== 'all') list = list.filter((r) => r.network === network);
    if (deferredQ.trim()) {
      const qq = deferredQ.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(qq) ||
          r.origin.toLowerCase().includes(qq) ||
          r.permissionLabels.toLowerCase().includes(qq),
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'permissions') return b.permissions - a.permissions;
      return b.lastActivity.localeCompare(a.lastActivity);
    });
    return list;
  }, [rows, network, deferredQ, sort]);

  async function disconnect(row: ConnectedDappRow): Promise<void> {
    try {
      if (live) {
        await Promise.all(
          row.permissionCodes.map((permission) =>
            web3Fetch('/api/v1/connections/dapps/permissions', {
              method: 'POST',
              body: JSON.stringify({
                origin: row.origin,
                permission,
                allowed: false,
              }),
            }),
          ),
        );
      }
      setDisconnected((prev) => [...prev, row.id]);
      setGrants((prev) => prev.filter((g) => g.origin !== row.origin));
      showToast(
        live
          ? 'Disconnected — permissions revoked with the connections service'
          : 'dApp disconnected in preview — open Permission center to manage grants',
      );
    } catch {
      showToast('Disconnect failed — try again from Permission center');
    }
  }

  return (
    <PlatformShell
      title="Connected apps"
      subtitle="The same connection list as Wallet → Connections. Manage sessions there to avoid two designs."
      reassure="Disconnecting a session does not send wallet keys. Tokens are never shown here."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/connections" />}
      actions={
        <Link href="/connections" className="cx-btn cx-btn--primary">
          Open Connections
        </Link>
      }
    >
      {ready && !live ? (
        <Alert tone="warn" title="Preview sessions">
          Showing curated connected apps while the connections service is offline. This list is not
          a verified-safe attestation.
        </Alert>
      ) : null}
      {toast ? (
        <Alert tone="success" title="Updated">
          {toast}
        </Alert>
      ) : null}

      <div className="cx-toolbar">
        <label className="cx-field">
          <span>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search dApps" />
        </label>
        <label className="cx-field">
          <span>Network</span>
          <select
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
            aria-label="Network filter"
          >
            <option value="all">All</option>
            <option value="ETHEREUM">Ethereum</option>
            <option value="POLYGON">Polygon</option>
          </select>
        </label>
        <label className="cx-field">
          <span>Sort</span>
          <select
            value={sort}
            onChange={(e) => {
              const v = e.target.value;
              if ((SORT_KEYS as string[]).includes(v)) setSort(v as SortKey);
            }}
            aria-label="Sort dApps"
          >
            <option value="activity">Last activity</option>
            <option value="name">Name</option>
            <option value="permissions">Permissions</option>
          </select>
        </label>
      </div>

      <section className="cx-panel">
        {filtered.length === 0 ? (
          <EmptyState
            title="No connected dApps"
            description="Approve a connection from the Web3 Hub."
          />
        ) : (
          <ul className="cx-list">
            {filtered.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p className="cx-meta">
                    {r.origin} · {r.network}
                  </p>
                  <p className="cx-meta">
                    {r.permissionLabels} · Last {new Date(r.lastActivity).toLocaleString()}
                  </p>
                  <span className="cx-badge">{riskLabel(r.risk)}</span>
                </div>
                <div className="cx-platform__actions">
                  <StatusBadge status="active" label="Connected" />
                  <Link href={`/web3/permissions?origin=${encodeURIComponent(r.origin)}`}>
                    <Button type="button" size="sm" variant="secondary">
                      Edit permissions
                    </Button>
                  </Link>
                  <Link href="/web3/activity">
                    <Button type="button" size="sm" variant="ghost">
                      Activity
                    </Button>
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => void disconnect(r)}
                    aria-label={`Disconnect ${r.name}`}
                  >
                    Disconnect
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Alert tone="info" title="Shared with Permission center">
        This settings view composes the `/web3/permissions` grant model. Prefer the Permission
        center for per-grant revoke and the full plain-language catalog.
      </Alert>
    </PlatformShell>
  );
}
