'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

type NavLink = { href: string; label: string; exact?: boolean };

const LINKS: NavLink[] = [
  { href: '/settings', label: 'Security', exact: true },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/devices', label: 'Devices' },
  { href: '/settings/dapps', label: 'dApps' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/settings/backup', label: 'Backup' },
  { href: '/settings/notifications', label: 'Alerts' },
  { href: '/settings/preferences', label: 'Prefs' },
  { href: '/settings/advanced', label: 'Advanced' },
  { href: '/settings/help', label: 'Help' },
];

export function SettingsSectionNav({ current }: { current: string }): ReactElement {
  return (
    <nav className="sc__tabs" aria-label="Settings sections">
      {LINKS.map((link) => {
        const on = link.exact ? current === link.href : current.startsWith(link.href);
        return (
          <Link key={link.href} className={`sc__tab ${on ? 'sc__tab--on' : ''}`} href={link.href}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
