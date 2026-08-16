/** Professional app-wide copy — never dump raw API bodies. */

export type DashboardIssue =
  | 'offline'
  | 'session'
  | 'revoked'
  | 'locked'
  | 'suspended'
  | 'rate_limited'
  | 'rpc'
  | 'market'
  | 'backend'
  | 'permission'
  | 'unknown';

export type AppIssue = DashboardIssue;

export function issueCopy(kind: DashboardIssue): { title: string; body: string } {
  switch (kind) {
    case 'offline':
      return {
        title: 'You are offline',
        body: 'Check your connection, then try again. Balances will refresh when this device reconnects.',
      };
    case 'session':
      return {
        title: 'Session expired',
        body: 'Sign in again to load your Auvora account. Your wallet keys stay on this device.',
      };
    case 'revoked':
      return {
        title: 'Signed out',
        body: 'This session was ended from another device or by a security reset. Sign in again to continue.',
      };
    case 'locked':
      return {
        title: 'Account locked',
        body: 'Too many sign-in attempts. Wait a few minutes, or reset your password. Your wallet on this device is unchanged.',
      };
    case 'suspended':
      return {
        title: 'Account suspended',
        body: 'This Auvora account cannot sign in right now. Contact support@auvorawallet.com. Your non-custodial wallet keys stay on this device.',
      };
    case 'rate_limited':
      return {
        title: 'Temporarily limited',
        body: 'Please wait a minute, then try again. Nothing was sent or signed.',
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
    case 'permission':
      return {
        title: 'Not allowed',
        body: 'You do not have access to this action. If this looks wrong, sign in again or contact support.',
      };
    case 'unknown':
      return {
        title: 'Something went wrong',
        body: 'Try again. If it continues, check Status or contact support. Your funds are not moved by this screen.',
      };
  }
}

export function classifyHttpStatus(status: number | undefined): DashboardIssue | null {
  if (status === 401) return 'session';
  if (status === 403) return 'permission';
  if (status === 423) return 'locked';
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
