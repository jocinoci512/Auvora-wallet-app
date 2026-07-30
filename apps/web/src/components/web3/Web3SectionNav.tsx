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
    <nav className="cx-tabs" aria-label="Web3 sections">
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
