'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useState, type ReactElement, type ReactNode } from 'react';
import { AppShell, ThemeToggle } from '@auvora/ui';
import { APP_NAV_SECTIONS, isCurrentPath, isMarketingPath } from '../lib/product/app-nav';
import { getCachedUser, isSignedIn, loadMe, signOut, type AuthUser } from '../lib/auth/session';
import { ReleaseConfig } from '../lib/release/config';
import { FeatureStatusBadge } from './shell/FeatureStatusBadge';
import { AccessTokenPanel } from './AccessTokenPanel';

function MarketingNav(): ReactElement {
  return (
    <header className="mh-nav">
      <Link href="/" className="mh-nav__brand">
        Auvora
      </Link>
      <div className="mh-nav__actions">
        <Link href="/trust" className="mh-nav__link">
          Trust
        </Link>
        <Link href="/settings/security" className="mh-nav__link">
          Security
        </Link>
        <Link href="/auth/login" className="mh-nav__link">
          Sign in
        </Link>
        <ThemeToggle />
        <Link href="/dashboard" className="mh-btn mh-btn--primary mh-btn--sm">
          Open app
        </Link>
      </div>
    </header>
  );
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
    <aside className="auv-sidebar" aria-label="App navigation">
      <div className="auv-sidebar__brand">
        <Link href="/dashboard">Auvora</Link>
        <span className="auv-sidebar__channel">{ReleaseConfig.buildLabel}</span>
      </div>
      <nav className="auv-sidebar__nav">
        {APP_NAV_SECTIONS.map((section) => (
          <div key={section.id} className="auv-sidebar__section">
            <p className="auv-sidebar__section-label">{section.label}</p>
            <ul>
              {section.items.map((item) => {
                const current = isCurrentPath(pathname, item.href);
                return (
                  <li key={`${item.href}-${item.label}`}>
                    <Link
                      href={item.href}
                      className={`auv-sidebar__link${current ? ' is-current' : ''}`}
                      aria-current={current ? 'page' : undefined}
                    >
                      <span>{item.label}</span>
                      {item.badge ? <FeatureStatusBadge status={item.badge} /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="auv-sidebar__foot">
        {user ? (
          <>
            <p className="auv-sidebar__user">{user.displayName || user.email}</p>
            <button type="button" className="auv-sidebar__signout" onClick={onSignOut}>
              Sign out
            </button>
          </>
        ) : (
          <Link href="/auth/login" className="auv-sidebar__link">
            Sign in for account sync
          </Link>
        )}
        <ThemeToggle />
      </div>
    </aside>
  );
}

function MobileAppBar({
  pathname,
  open,
  setOpen,
  menuId,
}: {
  pathname: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  menuId: string;
}): ReactElement {
  return (
    <div className="auv-mobilebar">
      <Link href="/dashboard" className="auv-mobilebar__brand">
        Auvora
      </Link>
      <div className="auv-mobilebar__actions">
        <ThemeToggle />
        <button
          type="button"
          className="auv-mobilebar__menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen(!open)}
        >
          Menu
        </button>
      </div>
      {open ? (
        <div id={menuId} className="auv-mobilebar__panel">
          {APP_NAV_SECTIONS.flatMap((s) =>
            s.items.map((item) => (
              <Link
                key={`m-${item.href}-${item.label}`}
                href={item.href}
                className={isCurrentPath(pathname, item.href) ? 'is-current' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
                {item.badge ? ` · ${item.badge}` : ''}
              </Link>
            )),
          )}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer AppChrome — kept for import compatibility. */
export function Nav(): ReactElement {
  return <MarketingNav />;
}

export function AppChrome({ children }: { children: ReactNode }): ReactElement {
  const pathname = usePathname() || '/';
  const menuId = useId();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isMarketingPath(pathname)) return;
    setUser(getCachedUser());
    if (isSignedIn()) {
      void loadMe().then(setUser);
    }
  }, [pathname]);

  if (isMarketingPath(pathname)) {
    return (
      <AppShell header={<MarketingNav />}>
        <main id="main-content">{children}</main>
      </AppShell>
    );
  }

  return (
    <AppShell
      header={
        <MobileAppBar
          pathname={pathname}
          open={mobileOpen}
          setOpen={setMobileOpen}
          menuId={menuId}
        />
      }
      sidebar={
        <AppSidebar
          pathname={pathname}
          user={user}
          onSignOut={() => {
            void signOut().then(() => setUser(null));
          }}
        />
      }
    >
      {process.env.NODE_ENV !== 'production' ? <AccessTokenPanel /> : null}
      <main id="main-content">{children}</main>
    </AppShell>
  );
}
