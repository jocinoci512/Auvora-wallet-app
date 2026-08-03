/**
 * Intelligent IA for authenticated companion shell.
 * Only expose real or honestly labeled surfaces.
 */

export type NavItem = {
  href: string;
  label: string;
  /** Optional honesty badge */
  badge?: 'Demo' | 'Beta' | 'Soon';
};

export type NavSection = {
  id: 'home' | 'money' | 'wallets' | 'web3' | 'insights' | 'security' | 'account';
  label: string;
  items: NavItem[];
};

export const APP_NAV_SECTIONS: NavSection[] = [
  {
    id: 'home',
    label: 'Home',
    items: [
      { href: '/dashboard', label: 'Overview', badge: 'Demo' },
      { href: '/portfolio', label: 'Portfolio', badge: 'Demo' },
      { href: '/activity', label: 'Activity', badge: 'Demo' },
    ],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { href: '/send', label: 'Send', badge: 'Demo' },
      { href: '/receive', label: 'Receive', badge: 'Demo' },
      { href: '/swap', label: 'Swap', badge: 'Soon' },
      { href: '/buy', label: 'Buy / Sell', badge: 'Soon' },
    ],
  },
  {
    id: 'wallets',
    label: 'Wallets',
    items: [
      { href: '/wallets', label: 'My wallets', badge: 'Beta' },
      { href: '/wallets/watch', label: 'Watch-only', badge: 'Beta' },
      { href: '/address-book', label: 'Address book' },
      { href: '/wallets/onboarding', label: 'Add wallet' },
    ],
  },
  {
    id: 'web3',
    label: 'Web3',
    items: [
      { href: '/web3/pair', label: 'Pair mobile', badge: 'Beta' },
      { href: '/web3/permissions', label: 'Permissions', badge: 'Demo' },
      { href: '/connections', label: 'Connections', badge: 'Beta' },
      { href: '/web3/sign', label: 'Sign preview', badge: 'Demo' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { href: '/insights', label: 'Insights', badge: 'Demo' },
      { href: '/market', label: 'Markets', badge: 'Beta' },
      { href: '/learn', label: 'Learn' },
      { href: '/assistant', label: 'Assistant', badge: 'Demo' },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    items: [
      { href: '/settings/security', label: 'Security Center' },
      { href: '/settings/devices', label: 'Devices & sessions', badge: 'Beta' },
      { href: '/settings/backup', label: 'Backup status', badge: 'Demo' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { href: '/settings/account', label: 'Profile', badge: 'Beta' },
      { href: '/settings', label: 'Settings' },
      { href: '/status', label: 'Status' },
      { href: '/auth/login', label: 'Sign in' },
    ],
  },
];

export function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/legal')) return true;
  if (pathname === '/trust') return true;
  if (pathname === '/design-system') return true;
  if (pathname.startsWith('/auth')) return true;
  return false;
}

export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
