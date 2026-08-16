'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

type NavLink = { href: string; label: string; exact?: boolean };

/** Consumer settings IA — only working first-class sections. */
const LINKS: NavLink[] = [
  { href: '/settings', label: 'Home', exact: true },
  { href: '/settings/account', label: 'Account' },
  { href: '/settings/security', label: 'Security' },
  { href: '/wallets', label: 'Wallets' },
  { href: '/settings/networks', label: 'Networks' },
  { href: '/connections', label: 'Connections' },
  { href: '/settings/preferences', label: 'Preferences' },
  { href: '/settings/help', label: 'Support' },
  { href: '/settings/about', label: 'About' },
];

export function SettingsSectionNav({ current }: { current: string }): ReactElement {
  return (
    <nav className="cx-tabs" aria-label="Settings sections">
      {LINKS.map((link) => {
        const on = link.exact
          ? current === link.href
          : current === link.href || current.startsWith(`${link.href}/`);
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
