'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { ThemeToggle } from '@auvora/ui';

const links = [
  { href: '/', label: 'Home' },
  { href: '/wallets', label: 'Wallets' },
  { href: '/blockchain', label: 'Blockchain' },
  { href: '/payments', label: 'Payments' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/custody', label: 'Custody' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/ai', label: 'AI' },
  { href: '/swap', label: 'Swap' },
  { href: '/nfts', label: 'NFTs' },
  { href: '/staking', label: 'Staking' },
  { href: '/connections', label: 'Connect' },
  { href: '/bridge', label: 'Bridge' },
  { href: '/observability', label: 'Ops' },
  { href: '/infrastructure', label: 'Infra' },
  { href: '/design-system', label: 'Design System' },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav(): ReactElement {
  const pathname = usePathname() || '/';

  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="site-nav__brand">Auvora Admin</div>
      <ul className="site-nav__links">
        {links.map((link) => {
          const current = isCurrent(pathname, link.href);
          return (
            <li key={link.href}>
              <Link href={link.href} aria-current={current ? 'page' : undefined}>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="site-nav__actions">
        <ThemeToggle />
      </div>
    </nav>
  );
}
