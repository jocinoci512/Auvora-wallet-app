'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { DEMO_DAPPS, type ConnectedDappRow } from '../../lib/settings/demo';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

type SortKey = 'name' | 'activity' | 'permissions';

const SORT_KEYS: SortKey[] = ['name', 'activity', 'permissions'];

export function ConnectedDappsSettingsExperience(): ReactElement {
  const [rows] = useState<ConnectedDappRow[]>(DEMO_DAPPS);
  const [q, setQ] = useState('');
  const deferredQ = useDeferredValue(q);
  const [network, setNetwork] = useState('all');
  const [sort, setSort] = useState<SortKey>('activity');
  const [disconnected, setDisconnected] = useState<string[]>([]);
  const { toast, showToast } = useTimedToast(2400);

  const filtered = useMemo(() => {
    let list = rows.filter((r) => !disconnected.includes(r.id));
    if (network !== 'all') list = list.filter((r) => r.network === network);
    if (deferredQ.trim()) {
      const qq = deferredQ.trim().toLowerCase();
      list = list.filter(
        (r) => r.name.toLowerCase().includes(qq) || r.origin.toLowerCase().includes(qq),
      );
    }
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'permissions') return b.permissions - a.permissions;
      return b.lastActivity.localeCompare(a.lastActivity);
    });
    return list;
  }, [rows, disconnected, network, deferredQ, sort]);

  function disconnect(id: string): void {
    setDisconnected((prev) => [...prev, id]);
    showToast('dApp disconnected locally — open Web3 permissions to revoke live grants');
  }

  return (
    <PlatformShell
      title="Connected dApps"
      subtitle="Search, filter, sort, disconnect, edit permissions, and review activity."
      reassure="Disconnecting here is local preview — use Permission center to revoke live grants."
      backHref="/settings"
      backLabel="Settings"
      nav={<SettingsSectionNav current="/settings/dapps" />}
      actions={
        <Link href="/web3/permissions" className="cx-btn cx-btn--primary">
          Permission center
        </Link>
      }
    >
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
                    {r.permissions} permissions · Last {new Date(r.lastActivity).toLocaleString()}
                  </p>
                </div>
                <div className="cx-platform__actions">
                  <StatusBadge status="active" label="Connected" />
                  <Link href={`/web3/sign?origin=${encodeURIComponent(r.origin)}`}>
                    <Button type="button" size="sm" variant="secondary">
                      Edit permissions
                    </Button>
                  </Link>
                  <Link href={`/web3/activity`}>
                    <Button type="button" size="sm" variant="ghost">
                      Activity
                    </Button>
                  </Link>
                  <Button type="button" size="sm" variant="danger" onClick={() => disconnect(r.id)}>
                    Disconnect
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PlatformShell>
  );
}
