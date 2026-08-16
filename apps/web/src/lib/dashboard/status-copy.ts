/** Professional dashboard copy — never dump raw API bodies. */

export type DashboardIssue = 'offline' | 'session' | 'rate_limited' | 'rpc' | 'market' | 'backend';

export function issueCopy(kind: DashboardIssue): { title: string; body: string } {
  switch (kind) {
    case 'offline':
      return {
        title: 'You are offline',
        body: 'Balances and activity will refresh when this device reconnects.',
      };
    case 'session':
      return {
        title: 'Session expired',
        body: 'Sign in again to load your Auvora account. Your wallet keys stay on this device.',
      };
    case 'rate_limited':
      return {
        title: 'Temporarily limited',
        body: 'Market or network providers asked us to slow down. Try again in a moment.',
      };
    case 'rpc':
      return {
        title: 'Network data delayed',
        body: 'A chain endpoint is unavailable. Holdings on this device are unchanged.',
      };
    case 'market':
      return {
        title: 'Market data unavailable',
        body: 'Balances still show. USD prices and 24h change will return when the feed recovers.',
      };
    case 'backend':
      return {
        title: 'Account services unavailable',
        body: 'We could not reach Auvora account services. You can still use this wallet on-device.',
      };
  }
}

export function classifyHttpStatus(status: number | undefined): DashboardIssue | null {
  if (status === 401 || status === 403) return 'session';
  if (status === 429) return 'rate_limited';
  if (status && status >= 500) return 'backend';
  return null;
}

export const EMPTY_COPY = {
  assets: {
    title: 'No assets yet',
    body: 'Create or import a non-custodial wallet to see balances here.',
    actionLabel: 'Add wallet',
    actionHref: '/wallets/onboarding',
  },
  activity: {
    title: 'No activity yet',
    body: 'Confirmed sends and receives will appear here.',
    actionLabel: 'Receive',
    actionHref: '/receive',
  },
  connections: {
    title: 'No connected apps',
    body: 'dApp and WalletConnect sessions you approve will show here.',
    actionLabel: 'Connections',
    actionHref: '/connections',
  },
  wallet: {
    title: 'Wallet not initialized',
    body: 'This device does not have a wallet yet. Auvora accounts never custody your keys.',
    actionLabel: 'Set up wallet',
    actionHref: '/wallets/onboarding',
  },
  account: {
    title: 'Account unavailable',
    body: 'Sign in to sync your Auvora account. The wallet on this device stays yours.',
    actionLabel: 'Sign in',
    actionHref: '/auth/login',
  },
} as const;
