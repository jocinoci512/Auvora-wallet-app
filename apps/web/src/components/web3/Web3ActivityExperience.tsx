'use client';

import { Alert, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { mapActivityItems, web3Fetch } from '../../lib/web3/api';
import { DEMO_ACTIVITY, type Web3ActivityItem } from '../../lib/web3/demo';
import { PlatformShell } from '../platform/PlatformShell';
import { Web3SectionNav } from './Web3SectionNav';

type Filter = 'all' | Web3ActivityItem['kind'];

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Recent' },
  { id: 'connected', label: 'Connected' },
  { id: 'signature', label: 'Signatures' },
  { id: 'transaction', label: 'Transactions' },
  { id: 'permission', label: 'Permissions' },
  { id: 'network', label: 'Networks' },
  { id: 'security', label: 'Security' },
];

export function Web3ActivityExperience(): ReactElement {
  const [items, setItems] = useState<Web3ActivityItem[]>(DEMO_ACTIVITY);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await web3Fetch<unknown>('/api/v1/connections/dapps/activity');
        if (cancelled) return;
        const mapped = mapActivityItems(data);
        if (mapped.length) setItems(mapped);
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err));
          setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.kind === filter)),
    [items, filter],
  );

  return (
    <PlatformShell
      title="Activity"
      subtitle="Connections, signatures, approvals, permission changes, network switches, and security alerts."
      reassure="Your Web3 history stays visible here so you can spot unusual requests early."
      backHref="/web3"
      backLabel="Web3 Hub"
      nav={<Web3SectionNav current="/web3/activity" />}
      actions={
        <Link href="/notifications" className="cx-btn cx-btn--ghost">
          Notifications
        </Link>
      }
    >
      {offline ? (
        <Alert tone="warn" title="Offline">
          Showing cached preview activity. Reconnect to sync live events.
        </Alert>
      ) : ready && error ? (
        <Alert tone="info" title="Preview activity">
          Live activity feed unavailable — curated timeline shown.
        </Alert>
      ) : null}

      <div className="cx-chips" role="group" aria-label="Activity filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`cx-chip${filter === f.id ? ' is-on' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="cx-panel">
        {filtered.length === 0 ? (
          <EmptyState
            title="No history"
            description="Web3 events for this filter will appear here."
          />
        ) : (
          <ul className="cx-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="cx-meta">
                    {item.detail}
                    {item.origin ? ` · ${item.origin}` : ''}
                  </p>
                  <p className="cx-meta">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <StatusBadge
                  status={
                    item.status === 'confirmed'
                      ? 'active'
                      : item.status === 'pending'
                        ? 'pending'
                        : 'failed'
                  }
                  label={item.status}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PlatformShell>
  );
}
