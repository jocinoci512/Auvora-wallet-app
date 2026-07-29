'use client';

import { PlatformCardLink, PlatformShell } from '../platform/PlatformShell';
import { SettingsSectionNav } from './SettingsSectionNav';
import type { ReactElement } from 'react';

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
    detail: 'Transactions, prices, security, Web3',
  },
  { href: '/settings/devices', title: 'Devices & sessions', detail: 'Trusted devices and logins' },
  { href: '/settings/dapps', title: 'Connected apps', detail: 'dApp inventory from settings' },
  { href: '/web3/permissions', title: 'Web3 permissions', detail: 'Revoke grants and sessions' },
  { href: '/settings/privacy', title: 'Privacy', detail: 'Analytics, cookies, personalization' },
  { href: '/settings/backup', title: 'Backup & recovery', detail: 'Phrase status and reminders' },
  { href: '/settings/advanced', title: 'Advanced', detail: 'Developer options (gated)' },
  { href: '/settings/help', title: 'Help & legal', detail: 'FAQ, support, scam awareness' },
  { href: '/notifications', title: 'Notification center', detail: 'Inbox and preferences' },
] as const;

export function SettingsHomeExperience(): ReactElement {
  return (
    <PlatformShell
      title="Settings"
      subtitle="Everything about your wallet — organized, searchable, and calm."
      reassure="Your assets are protected, organized, and always under your control."
      backHref="/dashboard"
      backLabel="Wallet"
      nav={<SettingsSectionNav current="/settings" />}
    >
      <section className="cx-panel">
        <h2>Categories</h2>
        <p>Choose a section. Security Center is the recommended starting point for protection.</p>
        <div className="cx-card-grid">
          {CATEGORIES.map((c) => (
            <PlatformCardLink key={c.href} href={c.href} title={c.title} detail={c.detail} />
          ))}
        </div>
      </section>

      <section className="cx-panel">
        <h2>About Auvora</h2>
        <p className="cx-meta">
          Premium self-custody with the Aether design language — clarity under pressure.
        </p>
        <div className="cx-platform__actions">
          <a className="cx-btn cx-btn--ghost" href="/design-system">
            Design system
          </a>
          <a className="cx-btn cx-btn--ghost" href="/status">
            Status
          </a>
        </div>
      </section>
    </PlatformShell>
  );
}
