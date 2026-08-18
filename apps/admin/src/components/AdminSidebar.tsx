'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { Sidebar } from '@auvora/ui';
import { useAdminIdentity } from '../lib/admin-identity';
import { useAdminNav } from '../lib/admin-nav';
import { hasPermission } from '../lib/admin-rbac';
import { isProductionBuild } from '../lib/api-client';

interface NavItem {
  href: string;
  label: string;
  permission?: string;
}

const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', permission: 'health:read' },
  { href: '/users', label: 'Users', permission: 'users:read' },
  { href: '/wallets', label: 'Wallets', permission: 'wallets:read' },
  { href: '/connections', label: 'Connections', permission: 'connections:read' },
  { href: '/security', label: 'Security', permission: 'security:read' },
  { href: '/security/audit', label: 'Audit', permission: 'audit:read' },
  { href: '/observability/health', label: 'System Health', permission: 'health:read' },
  { href: '/operators', label: 'Admin Management', permission: 'admins:read' },
  { href: '/settings', label: 'Settings' },
];

const MORE: NavItem[] = [
  { href: '/blockchain', label: 'Blockchain' },
  { href: '/payments', label: 'Payments' },
  { href: '/compliance', label: 'Compliance' },
  { href: '/custody', label: 'Custody' },
  { href: '/notifications', label: 'Notifications' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/observability', label: 'Observability' },
  { href: '/infrastructure', label: 'Infrastructure' },
  { href: '/ai', label: 'AI operations' },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === '/dashboard' || href === '/') return pathname === '/' || pathname === '/dashboard';
  if (href === '/security') return pathname === '/security';
  if (href === '/observability') {
    return (
      pathname === '/observability' ||
      (pathname.startsWith('/observability/') && !pathname.startsWith('/observability/health'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar(): ReactElement {
  const pathname = usePathname() || '/';
  const identity = useAdminIdentity();
  const { open, setOpen } = useAdminNav();
  const [moreOpen, setMoreOpen] = useState(MORE.some((item) => isCurrent(pathname, item.href)));
  const extra = isProductionBuild() ? [] : [{ href: '/design-system', label: 'Design system' }];

  return (
    <>
      {open ? (
        <button
          type="button"
          className="admin-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <Sidebar
        id="admin-navigation"
        className={`admin-sidebar${open ? ' admin-sidebar--open' : ''}`}
        aria-label="Admin navigation"
      >
        <p className="admin-sidebar__brand">Auvora Control Plane</p>
        <ul className="admin-sidebar__nav">
          {PRIMARY.map((item) => {
            if (item.permission && !hasPermission(identity?.operator, item.permission)) {
              return null;
            }
            const current = isCurrent(pathname, item.href);
            return (
              <li key={item.href}>
                <Link href={item.href} aria-current={current ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="admin-sidebar__more"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((current) => !current)}
        >
          More operations
        </button>
        {moreOpen ? (
          <ul className="admin-sidebar__nav admin-sidebar__nav--secondary">
            {[...MORE, ...extra].map((item) => {
              const current = isCurrent(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link href={item.href} aria-current={current ? 'page' : undefined}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Sidebar>
    </>
  );
}
