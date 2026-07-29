'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';

type NavLink = { href: string; label: string; exact?: boolean };

const LINKS: NavLink[] = [
  { href: '/web3', label: 'Hub', exact: true },
  { href: '/web3/browser', label: 'Browser' },
  { href: '/web3/permissions', label: 'Permissions' },
  { href: '/web3/sign', label: 'Signing' },
  { href: '/web3/activity', label: 'Activity' },
];

export function Web3SectionNav({ current }: { current: string }): ReactElement {
  return (
    <nav className="w3__tabs" aria-label="Web3 sections" style={{ marginBottom: '0.85rem' }}>
      {LINKS.map((link) => {
        const on = link.exact ? current === link.href : current.startsWith(link.href);
        return (
          <Link key={link.href} className={`w3__tab ${on ? 'w3__tab--on' : ''}`} href={link.href}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
