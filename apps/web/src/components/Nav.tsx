'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState, type ReactElement } from 'react';
import { ThemeToggle } from '@auvora/ui';

type NavLink = { href: string; label: string };

const primaryLinks: NavLink[] = [
  { href: '/dashboard', label: 'App' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/wallets', label: 'Wallets' },
  { href: '/send', label: 'Send' },
  { href: '/receive', label: 'Receive' },
  { href: '/swap', label: 'Swap' },
  { href: '/bridge', label: 'Bridge' },
  { href: '/web3', label: 'Web3' },
  { href: '/settings', label: 'Settings' },
  { href: '/notifications', label: 'Alerts' },
];

const moreLinks: NavLink[] = [
  { href: '/buy', label: 'Buy' },
  { href: '/sell', label: 'Sell' },
  { href: '/staking', label: 'Staking' },
  { href: '/digital-assets', label: 'Assets' },
  { href: '/nfts', label: 'NFTs' },
  { href: '/activity', label: 'Activity' },
  { href: '/address-book', label: 'Address book' },
  { href: '/security', label: 'Security' },
  { href: '/market', label: 'Market' },
  { href: '/blockchain', label: 'Blockchain' },
  { href: '/payments', label: 'Payments' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/custody', label: 'Custody' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/ai', label: 'AI' },
  { href: '/connections', label: 'Connect lab' },
  { href: '/status', label: 'Status' },
  { href: '/design-system', label: 'DS' },
];

const COMPACT_NAV_MQ = '(max-width: 900px)';

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function LinkItem({ link, pathname }: { link: NavLink; pathname: string }): ReactElement {
  const current = isCurrent(pathname, link.href);
  return (
    <li>
      <Link href={link.href} aria-current={current ? 'page' : undefined} className="site-nav__link">
        {link.label}
      </Link>
    </li>
  );
}

function MarketingNav(): ReactElement {
  return (
    <header className="mh-nav">
      <Link href="/" className="mh-nav__brand">
        Auvora
      </Link>
      <div className="mh-nav__actions">
        <Link href="/security" className="mh-nav__link">
          Security
        </Link>
        <Link href="/dashboard" className="mh-nav__link">
          App
        </Link>
        <ThemeToggle />
        <Link href="/wallets/onboarding" className="mh-btn mh-btn--primary mh-btn--sm">
          Get started
        </Link>
      </div>
    </header>
  );
}

export function Nav(): ReactElement {
  const pathname = usePathname() || '/';
  const moreId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const moreActive = moreLinks.some((l) => isCurrent(pathname, l.href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(COMPACT_NAV_MQ);
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (pathname === '/') {
    return <MarketingNav />;
  }

  return (
    <nav className="site-nav" aria-label="Primary">
      <div className="site-nav__top">
        <Link
          href="/"
          className="site-nav__brand"
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          Auvora
        </Link>
        <div className="site-nav__actions">
          <ThemeToggle />
        </div>
      </div>
      <ul className="site-nav__links site-nav__links--primary">
        {primaryLinks.map((link) => (
          <LinkItem key={`${link.href}-${link.label}`} link={link} pathname={pathname} />
        ))}
        {compact ? (
          <li className="site-nav__more site-nav__more--mobile">
            <button
              type="button"
              className="site-nav__more-toggle"
              aria-expanded={moreOpen}
              aria-controls={moreId}
              aria-label={
                moreOpen ? 'Hide additional destinations' : 'Show additional destinations'
              }
              onClick={() => setMoreOpen((v) => !v)}
            >
              More{moreActive ? ' ·' : ''}
            </button>
            <ul id={moreId} className="site-nav__more-panel" hidden={!moreOpen}>
              {moreLinks.map((link) => (
                <LinkItem key={`${link.href}-${link.label}`} link={link} pathname={pathname} />
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
      {!compact ? (
        <ul
          className="site-nav__links site-nav__links--secondary"
          aria-label="Additional destinations"
        >
          {moreLinks.map((link) => (
            <LinkItem key={`sec-${link.href}-${link.label}`} link={link} pathname={pathname} />
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
