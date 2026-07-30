'use client';

import { useDeferredValue, useMemo, useState, type ReactElement } from 'react';
import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';

const CATEGORIES = [
  {
    href: '/settings/security',
    title: 'Security',
    detail: 'Score, recovery, devices, sessions, dApps',
  },
  { href: '/settings/account', title: 'Account', detail: 'Profile, locale, wallet nickname' },
  {
    href: '/settings/preferences',
    title: 'Appearance & personalization',
    detail: 'Theme, currency, network, display, a11y',
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    detail: 'Transactions, smart alerts, insights, Web3',
  },
  { href: '/settings/devices', title: 'Devices & sessions', detail: 'Trusted devices and logins' },
  { href: '/settings/dapps', title: 'Connected apps', detail: 'dApp inventory from settings' },
  { href: '/web3/permissions', title: 'Web3 permissions', detail: 'Revoke grants and sessions' },
  {
    href: '/settings/privacy',
    title: 'Privacy',
    detail: 'Analytics, Assistant, cookies, personalization',
  },
  { href: '/legal', title: 'Legal drafts', detail: 'Privacy, terms, trust & transparency' },
  { href: '/settings/backup', title: 'Backup & recovery', detail: 'Phrase status and reminders' },
  { href: '/settings/advanced', title: 'Advanced', detail: 'Developer options (gated)' },
  { href: '/settings/help', title: 'Help & support', detail: 'FAQ, recovery, scam awareness' },
  { href: '/assistant', title: 'Auvora Assistant', detail: 'Plain-language explanations' },
  { href: '/learn', title: 'Education Hub', detail: 'Beginner guides and fundamentals' },
  { href: '/insights', title: 'Insights', detail: 'Portfolio health and gentle tips' },
  { href: '/notifications', title: 'Notification center', detail: 'Inbox and preferences' },
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
      subtitle="Find what you need — security first, everything else close by."
      reassure="Changes on this device stay under your control."
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
            placeholder="Security, theme, devices…"
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

      <section className="cx-panel">
        <h2>Need help?</h2>
        <p className="cx-meta">Clear answers on recovery, scams, and permissions.</p>
        <div className="cx-platform__actions">
          <a className="cx-btn cx-btn--ghost" href="/settings/help">
            Help & support
          </a>
          <a className="cx-btn cx-btn--ghost" href="/learn">
            Education Hub
          </a>
          <a className="cx-btn cx-btn--ghost" href="/assistant">
            Ask Assistant
          </a>
          <a className="cx-btn cx-btn--ghost" href="/status">
            Service status
          </a>
        </div>
      </section>
    </PlatformShell>
  );
}
