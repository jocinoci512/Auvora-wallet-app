'use client';

import {
  AuvoraClientError,
  type NotificationItem,
  type NotificationPreferences,
} from '@auvora/sdk';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { createApiClient, formatApiError } from '../../lib/api-client';
import { DEMO_SMART_ALERTS } from '../../lib/insights/demo';
import { getNotifPrefs, type NotificationPrefsLocal } from '../../lib/settings/prefs';
import { PlatformShell } from '../platform/PlatformShell';

type CategoryFilter = 'all' | 'tx' | 'price' | 'security' | 'staking' | 'system';

const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tx', label: 'Transactions' },
  { id: 'price', label: 'Price' },
  { id: 'security', label: 'Security' },
  { id: 'staking', label: 'Staking' },
  { id: 'system', label: 'System' },
];

const DEMO_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'demo-tx-1',
    category: 'tx',
    channel: 'IN_APP',
    priority: 'NORMAL',
    status: 'PENDING',
    subject: 'Transfer confirmed',
    body: '0.42 ETH received on Ethereum.',
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'demo-price-1',
    category: 'price',
    channel: 'IN_APP',
    priority: 'NORMAL',
    status: 'PENDING',
    subject: 'ETH above watchlist target',
    body: 'Ethereum crossed your $3,400 alert.',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'demo-security-1',
    category: 'security',
    channel: 'IN_APP',
    priority: 'HIGH',
    status: 'PENDING',
    subject: 'New device signed in',
    body: 'Chrome on Windows — review devices if this was not you.',
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'demo-staking-1',
    category: 'staking',
    channel: 'IN_APP',
    priority: 'NORMAL',
    status: 'DELIVERED',
    subject: 'Staking reward credited',
    body: '0.018 ETH reward from your liquid staking position.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'demo-system-1',
    category: 'system',
    channel: 'IN_APP',
    priority: 'LOW',
    status: 'DELIVERED',
    subject: 'Maintenance window complete',
    body: 'Gateway sync finished — balances are up to date.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
];

function normalizeCategory(raw: string): CategoryFilter {
  const c = raw.toLowerCase();
  if (c.includes('tx') || c.includes('transaction') || c.includes('transfer')) return 'tx';
  if (c.includes('price') || c.includes('market')) return 'price';
  if (c.includes('security') || c.includes('device') || c.includes('session')) return 'security';
  if (c.includes('stak') || c.includes('reward')) return 'staking';
  if (c.includes('system') || c.includes('product') || c.includes('maintenance')) return 'system';
  return 'system';
}

export function NotificationCenterExperience(): ReactElement {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [localPrefs, setLocalPrefs] = useState<NotificationPrefsLocal>(() => getNotifPrefs());
  const [error, setError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [apiAvailable, setApiAvailable] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setLocalPrefs(getNotifPrefs());
    try {
      const client = createApiClient();
      const [list, preferences] = await Promise.all([
        client.listNotifications(),
        client.getNotificationPreferences(),
      ]);
      setItems(list.items);
      setPrefs(preferences);
      setDemoMode(false);
      setApiAvailable(true);
    } catch (err) {
      if (err instanceof AuvoraClientError && err.status === 401) {
        setItems(DEMO_NOTIFICATIONS);
        setPrefs(null);
        setDemoMode(true);
        setApiAvailable(false);
        setError(null);
      } else {
        setError(formatApiError(err));
        setItems(DEMO_NOTIFICATIONS);
        setDemoMode(true);
        setApiAvailable(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (category === 'all') return items;
    return items.filter((n) => normalizeCategory(n.category) === category);
  }, [items, category]);

  const smartAlerts = useMemo(() => {
    return DEMO_SMART_ALERTS.filter((a) => {
      const key = a.category as keyof NotificationPrefsLocal;
      return localPrefs[key] !== false;
    });
  }, [localPrefs]);

  async function markRead(id: string): Promise<void> {
    if (!apiAvailable || demoMode) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'DELIVERED' } : n)));
      return;
    }
    try {
      const client = createApiClient();
      await client.markNotificationRead(id);
      await load();
    } catch (err) {
      setError(formatApiError(err));
    }
  }

  return (
    <PlatformShell
      title="Notification center"
      subtitle="Inbox for transactions, smart alerts, prices, security, staking, and system updates."
      reassure="Unread alerts stay here until you mark them read — nothing moves funds. Tune every category in preferences."
      backHref="/settings"
      backLabel="Settings"
      actions={
        <>
          <Link href="/settings/notifications" className="cx-btn cx-btn--ghost">
            Alert settings
          </Link>
          <Link href="/insights" className="cx-btn cx-btn--ghost">
            Insights
          </Link>
          <Link href="/notifications/preferences" className="cx-btn cx-btn--primary">
            Delivery settings
          </Link>
        </>
      }
    >
      {demoMode ? (
        <div className="cx-alert cx-alert--info" role="status">
          Live inbox unavailable — curated demo notifications are shown for preview.
        </div>
      ) : null}
      {error ? (
        <div className="cx-alert cx-alert--error" role="alert">
          {error}
        </div>
      ) : null}

      {prefs ? (
        <p className="cx-meta">
          Language {prefs.language} · TZ {prefs.timeZone}
          {prefs.quietHoursStart != null
            ? ` · Quiet ${prefs.quietHoursStart}:00–${prefs.quietHoursEnd ?? '?'}:00`
            : ''}
        </p>
      ) : null}

      {smartAlerts.length > 0 ? (
        <section className="cx-panel">
          <h2>Smart alerts</h2>
          <p className="cx-meta">
            Preview examples filtered by your preferences — not live events until delivery is
            connected. Educational and situational; nothing here moves funds.
          </p>
          <ul className="cx-list">
            {smartAlerts.map((a) => (
              <li key={a.id}>
                <div>
                  <strong>{a.title}</strong>
                  <p className="cx-meta">{a.detail}</p>
                  <span className="cx-badge cx-badge--pending">Preview</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="cx-panel">
          <h2>Smart alerts</h2>
          <p className="cx-meta">
            All smart alert categories are off.{' '}
            <Link href="/settings/notifications">Turn categories on</Link> if you want examples.
          </p>
        </section>
      )}

      <div className="cx-chips" role="group" aria-label="Filter by category">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={category === c.id}
            className={`cx-chip${category === c.id ? ' is-on' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="cx-panel">
        {filtered.length === 0 ? (
          <div className="cx-empty">
            <h2>No notifications</h2>
            <p>Nothing in this category right now.</p>
          </div>
        ) : (
          <ul className="cx-list">
            {filtered.map((n) => {
              const cat = normalizeCategory(n.category);
              const unread = n.status !== 'DELIVERED' && n.status !== 'READ';
              return (
                <li key={n.id}>
                  <div>
                    <strong>{n.subject ?? n.category}</strong>
                    <p className="cx-meta">
                      {CATEGORIES.find((c) => c.id === cat)?.label ?? cat}
                      {n.createdAt ? ` · ${new Date(n.createdAt).toLocaleString()}` : ''}
                      {unread ? ' · Unread' : ' · Read'}
                    </p>
                    <p className="cx-meta">{n.body}</p>
                  </div>
                  {unread && apiAvailable ? (
                    <button
                      type="button"
                      className="cx-btn cx-btn--ghost"
                      onClick={() => void markRead(n.id)}
                    >
                      Mark read
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="cx-platform__actions">
        <Link href="/settings/notifications" className="cx-link">
          Notification preferences
        </Link>
      </div>
    </PlatformShell>
  );
}
