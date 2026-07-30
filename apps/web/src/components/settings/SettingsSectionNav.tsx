'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

type NavLink = { href: string; label: string; exact?: boolean };

/** Logical Settings IA — Security is a first-class category, not the home. */
const LINKS: NavLink[] = [
  { href: '/settings', label: 'Home', exact: true },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/preferences', label: 'Appearance' },
  { href: '/settings/security', label: 'Security' },
  { href: '/settings/notifications', label: 'Alerts' },
  { href: '/settings/alerts', label: 'Prices' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/settings/networks', label: 'Networks' },
  { href: '/settings/devices', label: 'Devices' },
  { href: '/settings/dapps', label: 'Apps' },
  { href: '/settings/backup', label: 'Backup' },
  { href: '/settings/advanced', label: 'Advanced' },
  { href: '/settings/help', label: 'Help' },
  { href: '/settings/about', label: 'About' },
];

export function SettingsSectionNav({ current }: { current: string }): ReactElement {
  return (
    <nav className="cx-tabs" aria-label="Settings sections">
      {LINKS.map((link) => {
        const on = link.exact ? current === link.href : current.startsWith(link.href);
        return (
          <Link
            key={link.href}
            className={on ? 'is-active' : undefined}
            href={link.href}
            aria-current={on ? 'page' : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
