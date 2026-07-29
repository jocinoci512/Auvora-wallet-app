'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { DEMO_DAPPS, type ConnectedDappRow } from '../../lib/settings/demo';
import { useTimedToast } from '../../lib/settings/use-timed-toast';
import { SettingsSectionNav } from './SettingsSectionNav';
import '../../app/settings-experience.css';

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
    <div className="sc">
      <header className="sc__header">
        <div>
          <p className="sc__eyebrow">
            <Link href="/settings">Security Center</Link>
          </p>
          <h1>Connected dApps</h1>
          <p className="sc__sub">
            Search, filter, sort, disconnect, edit permissions, and review activity.
          </p>
        </div>
        <Link href="/web3/permissions">
          <Button type="button">Permission center</Button>
        </Link>
      </header>
      <SettingsSectionNav current="/settings/dapps" />
      {toast ? (
        <Alert tone="success" title="Updated">
          {toast}
        </Alert>
      ) : null}

      <div className="sc-toolbar">
        <label className="sc-field">
          <span>Search</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search dApps" />
        </label>
        <label className="sc-field">
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
        <label className="sc-field">
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

      <section className="sc-panel">
        {filtered.length === 0 ? (
          <EmptyState
            title="No connected dApps"
            description="Approve a connection from the Web3 Hub."
          />
        ) : (
          <ul className="sc-list">
            {filtered.map((r) => (
              <li key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <p className="sc-meta">
                    {r.origin} · {r.network}
                  </p>
                  <p className="sc-meta">
                    {r.permissions} permissions · Last {new Date(r.lastActivity).toLocaleString()}
                  </p>
                </div>
                <div className="sc-actions">
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
    </div>
  );
}
