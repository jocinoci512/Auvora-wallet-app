'use client';

import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { fuzzyRank } from '../../lib/search/fuzzy';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const CATEGORIES = [
  {
    href: '/settings/account',
    title: 'Account',
    detail: 'Email, display name, and verification',
  },
  {
    href: '/settings/security',
    title: 'Security',
    detail: 'Password, backup, devices, and sessions',
  },
  {
    href: '/wallets',
    title: 'Wallets',
    detail: 'Create, import, or manage wallets on this device',
  },
  {
    href: '/settings/networks',
    title: 'Networks',
    detail: 'Bitcoin, Ethereum, Solana, BNB Smart Chain, Polygon, Tron',
  },
  {
    href: '/connections',
    title: 'Connections',
    detail: 'Connected apps and WalletConnect sessions',
  },
  {
    href: '/settings/preferences',
    title: 'Preferences',
    detail: 'Theme, currency, and display',
  },
  {
    href: '/settings/help',
    title: 'Support',
    detail: 'Help, security guidance, and contact',
  },
  {
    href: '/settings/about',
    title: 'About',
    detail: 'Version, privacy, and terms',
  },
] as const;

export function SettingsHomeExperience(): ReactElement {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const filtered = useMemo(() => {
    const q = deferred.trim();
    if (!q) return [...CATEGORIES];
    return fuzzyRank(q, CATEGORIES, (c) => [c.title, c.detail]);
  }, [deferred]);

  return (
    <PlatformShell
      title="Settings"
      subtitle="Account, security, wallets, and preferences — only what this product actually supports."
      reassure="Auvora Account is identity and preferences. Wallet keys never leave this device through account login."
      backHref="/dashboard"
      backLabel="Wallet"
      nav={<SettingsSectionNav current="/settings" />}
    >
      <section className="cx-panel">
        <h2>Browse</h2>
        <p>Start with Account or Security. Search to jump elsewhere.</p>
        <label className="cx-field">
          <span>Search settings</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Theme, recovery, networks…"
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
