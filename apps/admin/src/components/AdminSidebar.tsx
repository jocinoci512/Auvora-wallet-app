'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';
import { Sidebar, BrandLogo } from '@auvora/ui';
import { useAdminIdentity } from '../lib/admin-identity';
import { useAdminNav } from '../lib/admin-nav';
import { hasPermission } from '../lib/admin-rbac';
import { isProductionBuild } from '../lib/api-client';

interface NavItem {
  href: string;
  label: string;
  permission?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', permission: 'health:read' }],
  },
  {
    label: 'Customers',
    items: [
      { href: '/users', label: 'Users', permission: 'users:read' },
      { href: '/wallets', label: 'Wallets', permission: 'wallets:read' },
      { href: '/compliance', label: 'KYC', permission: 'compliance:review' },
    ],
  },
  {
    label: 'Transactions',
    items: [
      {
        href: '/transaction-reviews',
        label: 'Transaction Reviews',
        permission: 'transactions:review:large',
      },
    ],
  },
  {
    label: 'Testing',
    items: [{ href: '/simulation', label: 'Simulation', permission: 'simulation:read' }],
  },
  {
    label: 'Connectivity',
    items: [{ href: '/connections', label: 'Connections', permission: 'connections:read' }],
  },
  {
    label: 'Security',
    items: [
      { href: '/security', label: 'Security Events', permission: 'security:read' },
      { href: '/security/audit', label: 'Audit', permission: 'audit:read' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/observability/health', label: 'Health', permission: 'health:read' },
      { href: '/blockchain', label: 'Blockchain', permission: 'blockchain:read' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { href: '/operators', label: 'Admin Management', permission: 'admins:read' },
      { href: '/settings', label: 'Settings' },
    ],
  },
];

const DEFERRED: NavItem[] = [
  { href: '/payments', label: 'Payments' },
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
  const deferred = isProductionBuild()
    ? []
    : [...DEFERRED, { href: '/design-system', label: 'Design system' }];

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
        <div className="admin-sidebar__brand">
          <BrandLogo
            variant="primary"
            height={26}
            alt="Auvora Admin"
            className="admin-sidebar__logo"
          />
          <p className="admin-sidebar__brand-label">Admin</p>
        </div>
        {NAV_GROUPS.map((group) => {
          const visible = group.items.filter(
            (item) => !item.permission || hasPermission(identity?.operator, item.permission),
          );
          if (visible.length === 0) return null;
          return (
            <div key={group.label} className="admin-sidebar__group">
              <p className="admin-sidebar__group-label">{group.label}</p>
              <ul className="admin-sidebar__nav">
                {visible.map((item) => {
                  const current = isCurrent(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={current ? 'page' : undefined}
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {deferred.length > 0 ? (
          <div className="admin-sidebar__group">
            <p className="admin-sidebar__group-label">Lab only</p>
            <ul className="admin-sidebar__nav admin-sidebar__nav--secondary">
              {deferred.map((item) => {
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
          </div>
        ) : null}
      </Sidebar>
    </>
  );
}
