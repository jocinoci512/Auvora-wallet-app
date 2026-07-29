'use client';

import { Alert, Button, EmptyState, StatusBadge } from '@auvora/ui';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { formatApiError } from '../../lib/api-client';
import { mapActivityItems, web3Fetch } from '../../lib/web3/api';
import { DEMO_ACTIVITY, type Web3ActivityItem } from '../../lib/web3/demo';
import { Web3SectionNav } from './Web3SectionNav';
import '../../app/web3-experience.css';

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
    <div className="w3">
      <header className="w3__header">
        <div>
          <p className="w3__eyebrow">
            <Link href="/web3">Web3 Hub</Link>
          </p>
          <h1>Web3 activity</h1>
          <p className="w3__sub">
            Connections, signatures, approvals, permission changes, network switches, and security
            alerts.
          </p>
        </div>
        <Link href="/notifications">
          <Button type="button" variant="secondary">
            Notifications
          </Button>
        </Link>
      </header>

      <Web3SectionNav current="/web3/activity" />

      {offline ? (
        <Alert tone="warn" title="Offline">
          Showing cached preview activity. Reconnect to sync live events.
        </Alert>
      ) : ready && error ? (
        <Alert tone="info" title="Preview activity">
          Live activity feed unavailable — curated timeline shown.
        </Alert>
      ) : null}

      <div className="w3__tabs" role="group" aria-label="Activity filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`w3__tab ${filter === f.id ? 'w3__tab--on' : ''}`}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="w3-panel">
        {filtered.length === 0 ? (
          <EmptyState
            title="No history"
            description="Web3 events for this filter will appear here."
          />
        ) : (
          <ul className="w3-list">
            {filtered.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <p className="w3-meta">
                    {item.detail}
                    {item.origin ? ` · ${item.origin}` : ''}
                  </p>
                  <p className="w3-meta">{new Date(item.timestamp).toLocaleString()}</p>
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
    </div>
  );
}
