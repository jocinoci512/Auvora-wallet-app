/**
 * Authenticated companion shell IA.
 * Only working destinations — no NFT, no invented routes.
 */

export type NavItem = {
  href: string;
  label: string;
};

export type NavSection = {
  id: 'primary' | 'account';
  label: string;
  items: NavItem[];
};

export const APP_NAV_SECTIONS: NavSection[] = [
  {
    id: 'primary',
    label: 'Wallet',
    items: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/portfolio', label: 'Assets' },
      { href: '/activity', label: 'Activity' },
      { href: '/connections', label: 'Connections' },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { href: '/settings/account', label: 'Account' },
      { href: '/settings', label: 'Settings' },
      { href: '/settings/security', label: 'Security' },
    ],
  },
];

export const APP_NAV_HREFS: string[] = APP_NAV_SECTIONS.flatMap((s) => s.items.map((i) => i.href));

export function isMarketingPath(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/legal')) return true;
  if (pathname === '/trust') return true;
  if (pathname === '/design-system') return true;
  if (pathname.startsWith('/auth')) return true;
  return false;
}

export function isCurrentPath(
  pathname: string,
  href: string,
  allHrefs: readonly string[] = APP_NAV_HREFS,
): boolean {
  if (href === '/') return pathname === '/';
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  const moreSpecific = allHrefs.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
  return !moreSpecific;
}

const PAGE_TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/dashboard', title: 'Overview' },
  { prefix: '/portfolio', title: 'Assets' },
  { prefix: '/activity', title: 'Activity' },
  { prefix: '/connections', title: 'Connections' },
  { prefix: '/settings/account', title: 'Account' },
  { prefix: '/settings/security', title: 'Security' },
  { prefix: '/settings', title: 'Settings' },
  { prefix: '/send', title: 'Send' },
  { prefix: '/receive', title: 'Receive' },
  { prefix: '/wallets', title: 'Wallets' },
  { prefix: '/web3', title: 'Connections' },
];

export function pageTitleForPath(pathname: string): string {
  const hit = PAGE_TITLES.find(
    (row) => pathname === row.prefix || pathname.startsWith(`${row.prefix}/`),
  );
  return hit?.title ?? 'Wallet';
}
