'use client';

import {
  History,
  LayoutGrid,
  Link2,
  MoreHorizontal,
  Settings,
  Shield,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { AppShell, ThemeToggle } from '@auvora/ui';
import {
  APP_NAV_SECTIONS,
  isCurrentPath,
  isMarketingPath,
  pageTitleForPath,
} from '../lib/product/app-nav';
import { getCachedUser, isSignedIn, loadMe, signOut, type AuthUser } from '../lib/auth/session';
import { AccessTokenPanel } from './AccessTokenPanel';
import '../app/wallet-shell.css';
import '../app/consumer.css';

const NAV_ICONS = {
  '/dashboard': LayoutGrid,
  '/portfolio': Wallet,
  '/activity': History,
  '/connections': Link2,
  '/settings/account': UserRound,
  '/settings': Settings,
  '/settings/security': Shield,
} as const;

function MarketingNav(): ReactElement {
  return (
    <header className="mh-nav">
      <Link href="/" className="mh-nav__brand">
        Auvora
      </Link>
      <nav className="mh-nav__links" aria-label="Primary">
        <Link href="/#security" className="mh-nav__link">
          Security
        </Link>
        <Link href="/#networks" className="mh-nav__link">
          Networks
        </Link>
        <Link href="/#features" className="mh-nav__link">
          Features
        </Link>
        <Link href="/trust" className="mh-nav__link">
          Trust
        </Link>
      </nav>
      <details className="mh-nav__menu">
        <summary>Menu</summary>
        <nav aria-label="Mobile">
          <Link href="/#security">Security</Link>
          <Link href="/#networks">Networks</Link>
          <Link href="/#features">Features</Link>
          <Link href="/trust">Trust</Link>
          <Link href="/auth/login">Sign in</Link>
        </nav>
      </details>
      <div className="mh-nav__actions">
        <Link href="/auth/login" className="mh-nav__link mh-nav__link--signin">
          Sign in
        </Link>
        <ThemeToggle />
        <Link href="/wallets/onboarding" className="mh-btn mh-btn--primary mh-btn--sm">
          Open Wallet
        </Link>
      </div>
    </header>
  );
}

function navIcon(href: string) {
  return NAV_ICONS[href as keyof typeof NAV_ICONS] ?? LayoutGrid;
}

function AppSidebar({
  pathname,
  user,
  onSignOut,
}: {
  pathname: string;
  user: AuthUser | null;
  onSignOut: () => void;
}): ReactElement {
  return (
    <aside className="ws-sidebar" aria-label="Wallet">
      <div className="ws-sidebar__brand">
        <Link href="/dashboard" aria-label="Auvora">
          <span className="ws-sidebar__wordmark">Auvora</span>
          <span className="ws-sidebar__mark" aria-hidden>
            A
          </span>
        </Link>
      </div>
      <nav className="ws-sidebar__nav">
        {APP_NAV_SECTIONS.map((section) => (
          <div key={section.id} className="ws-sidebar__section">
            <p className="ws-sidebar__label">{section.label}</p>
            <ul className="ws-sidebar__list">
              {section.items.map((item) => {
                const current = isCurrentPath(pathname, item.href);
                const Icon = navIcon(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`ws-sidebar__link${current ? ' is-current' : ''}`}
                      aria-current={current ? 'page' : undefined}
                      title={item.label}
                    >
                      <Icon size={18} aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="ws-sidebar__foot">
        <p className="ws-sidebar__cue">Non-custodial · keys on this device</p>
        {user ? (
          <>
            <p className="ws-sidebar__user">{user.displayName || user.email}</p>
            <button type="button" className="ws-sidebar__signout" onClick={onSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="ws-sidebar__signin">
            Sign in
          </Link>
        )}
        {process.env.NODE_ENV !== 'production' ? <AccessTokenPanel /> : null}
      </div>
    </aside>
  );
}

function AppTopbar({
  pathname,
  user,
  online,
}: {
  pathname: string;
  user: AuthUser | null;
  online: boolean;
}): ReactElement {
  return (
    <header className="ws-topbar">
      <div className="ws-topbar__identity">
        <p className="ws-topbar__kicker">Wallet</p>
        <h1 className="ws-topbar__title">{pageTitleForPath(pathname)}</h1>
      </div>
      <div className="ws-topbar__tools">
        <span
          className={`ws-status${online ? '' : ' is-off'}`}
          title={online ? 'This device is online' : 'This device is offline'}
        >
          <span className="ws-status__pip" aria-hidden />
          <span>{online ? 'Online' : 'Offline'}</span>
        </span>
        {user ? (
          <Link href="/settings/account" className="ws-account">
            <span className="ws-account__kind">Auvora account</span>
            <span className="ws-account__name">{user.displayName || user.email}</span>
          </Link>
        ) : (
          <Link href="/auth/login" className="ws-account">
            <span className="ws-account__kind">Auvora account</span>
            <span className="ws-account__name">Sign in</span>
          </Link>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

function AppTabBar({
  pathname,
  moreOpen,
  setMoreOpen,
}: {
  pathname: string;
  moreOpen: boolean;
  setMoreOpen: (v: boolean) => void;
}): ReactElement {
  const primary = APP_NAV_SECTIONS.find((s) => s.id === 'primary')?.items ?? [];
  const secondary = APP_NAV_SECTIONS.find((s) => s.id === 'account')?.items ?? [];

  return (
    <>
      <nav className="ws-tabbar" aria-label="Primary">
        {primary.map((item) => {
          const current = isCurrentPath(pathname, item.href);
          const Icon = navIcon(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={current ? 'is-current' : undefined}
              aria-current={current ? 'page' : undefined}
              onClick={() => setMoreOpen(false)}
            >
              <Icon size={18} aria-hidden />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          className={moreOpen ? 'is-current' : undefined}
          aria-expanded={moreOpen}
          aria-controls="ws-more-panel"
          onClick={() => setMoreOpen(!moreOpen)}
        >
          <MoreHorizontal size={18} aria-hidden />
          More
        </button>
      </nav>
      {moreOpen ? (
        <div className="ws-more" role="presentation" onClick={() => setMoreOpen(false)}>
          <div
            id="ws-more-panel"
            className="ws-more__panel"
            role="dialog"
            aria-label="Account"
            onClick={(e) => e.stopPropagation()}
          >
            {secondary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isCurrentPath(pathname, item.href) ? 'is-current' : undefined}
                onClick={() => setMoreOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/** @deprecated Prefer AppChrome — kept for import compatibility. */
export function Nav(): ReactElement {
  return <MarketingNav />;
}

export function AppChrome({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname() || '/';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isMarketingPath(pathname)) return;
    setUser(getCachedUser());
    if (isSignedIn()) {
      void loadMe().then(setUser);
    }
  }, [pathname]);

  useEffect(() => {
    const sync = () => setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (pathname.startsWith('/auth')) {
    return (
      <div className="as-chrome">
        <header className="as-chrome__bar">
          <Link href="/" className="as-chrome__brand">
            Auvora
          </Link>
          <ThemeToggle />
        </header>
        <main id="main-content">{children}</main>
      </div>
    );
  }

  if (isMarketingPath(pathname)) {
    return (
      <AppShell header={<MarketingNav />}>
        <main id="main-content">{children}</main>
      </AppShell>
    );
  }

  return (
    <div className="ws">
      <AppSidebar
        pathname={pathname}
        user={user}
        onSignOut={() => {
          void signOut().then(() => setUser(null));
        }}
      />
      <div className="ws-stage">
        <AppTopbar pathname={pathname} user={user} online={online} />
        <main id="main-content" className="ws-main">
          {children}
        </main>
      </div>
      <AppTabBar pathname={pathname} moreOpen={moreOpen} setMoreOpen={setMoreOpen} />
    </div>
  );
}
