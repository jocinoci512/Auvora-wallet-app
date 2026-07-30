'use client';

import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const CATEGORIES = [
  {
    href: '/settings/account',
    title: 'Account',
    detail: 'Wallet name, nickname, and preview wallet list',
  },
  {
    href: '/settings/preferences',
    title: 'Wallet & appearance',
    detail: 'Theme, currency, sorting, formats, and accessibility',
  },
  {
    href: '/settings/security',
    title: 'Security',
    detail: 'Score, recovery, devices, sessions, and protection',
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    detail: 'Choose which alerts matter — silence the rest',
  },
  {
    href: '/settings/alerts',
    title: 'Price alerts',
    detail: 'Create, pause, and delete custom targets',
  },
  {
    href: '/settings/privacy',
    title: 'Privacy',
    detail: 'Balances, analytics, clipboard, and Assistant',
  },
  {
    href: '/settings/networks',
    title: 'Networks',
    detail: 'Default network and preview RPC health',
  },
  {
    href: '/settings/devices',
    title: 'Devices & sessions',
    detail: 'Trusted devices and active logins',
  },
  {
    href: '/settings/dapps',
    title: 'Connected apps',
    detail: 'dApp inventory from settings',
  },
  {
    href: '/web3/permissions',
    title: 'Web3 permissions',
    detail: 'Revoke grants and sessions',
  },
  {
    href: '/settings/backup',
    title: 'Backup & recovery',
    detail: 'Phrase status and reminders',
  },
  {
    href: '/settings/advanced',
    title: 'Advanced',
    detail: 'Developer options — gated until needed',
  },
  {
    href: '/settings/help',
    title: 'Support',
    detail: 'FAQ, guides, and contact',
  },
  {
    href: '/settings/about',
    title: 'About',
    detail: 'Version, legal, and acknowledgements',
  },
  {
    href: '/notifications',
    title: 'Notification center',
    detail: 'In-app inbox for this device',
  },
] as const;

export function SettingsHomeExperience(): ReactElement {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase();
    if (!q) return CATEGORIES;
    return CATEGORIES.filter(
      (c) => c.title.toLowerCase().includes(q) || c.detail.toLowerCase().includes(q),
    );
  }, [deferred]);

  return (
    <PlatformShell
      title="Settings"
      subtitle="Find what you need in under ten seconds — clear categories, short descriptions."
      reassure="Changes on this device stay under your control. Advanced options stay out of the way."
      backHref="/dashboard"
      backLabel="Wallet"
      nav={<SettingsSectionNav current="/settings" />}
    >
      <section className="cx-panel">
        <h2>Browse</h2>
        <p>Start with Security if you are setting up protection. Search to jump elsewhere.</p>
        <label className="cx-field">
          <span>Search settings</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Theme, alerts, networks…"
            aria-label="Search settings"
          />
        </label>
        {filtered.length === 0 ? (
          <div className="cx-empty">
            <h2>No matches</h2>
            <p>Try another word, or clear the search.</p>
          </div>
        ) : (
          <div className="cx-card-grid">
            {filtered.map((c) => (
              <PlatformCardLink key={c.href} href={c.href} title={c.title} detail={c.detail} />
            ))}
          </div>
        )}
      </section>
    </PlatformShell>
  );
}
