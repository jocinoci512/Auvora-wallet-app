/**
 * Single source of truth for what the web product may claim.
 * Classifications must match ACTUAL implementation — not UI presence.
 */

export type FeatureStatus = 'LIVE' | 'BETA' | 'DEMO' | 'COMING_SOON' | 'ABSENT' | 'REMOVE';

export type FeatureEntry = {
  id: string;
  label: string;
  status: FeatureStatus;
  /** Honest one-line note for UI / report */
  note: string;
  /** Primary route if exposed */
  href?: string;
};

/** Chains with real mobile/backend support (Alchemy verified for these). */
export const SUPPORTED_CHAINS_LIVE = [
  { code: 'BTC', name: 'Bitcoin' },
  { code: 'ETH', name: 'Ethereum' },
  { code: 'SOL', name: 'Solana' },
  { code: 'BNB', name: 'BNB Smart Chain' },
  { code: 'POL', name: 'Polygon' },
  { code: 'TRX', name: 'Tron' },
] as const;

/** Mentioned in UI historically but not product-ready — classify honestly. */
export const CHAINS_COMING_SOON = [
  { code: 'AVAX', name: 'Avalanche' },
  { code: 'BASE', name: 'Base' },
  { code: 'ARB', name: 'Arbitrum' },
  { code: 'OP', name: 'Optimism' },
] as const;

export const FEATURE_CATALOG: FeatureEntry[] = [
  {
    id: 'portfolio-demo',
    label: 'Portfolio (demonstration)',
    status: 'DEMO',
    note: 'Marketing/home may show sample balances. Live holdings require signed-in wallet addresses + Alchemy/RPC.',
    href: '/portfolio',
  },
  {
    id: 'portfolio-live',
    label: 'Live portfolio via Alchemy/RPC',
    status: 'BETA',
    note: 'Backend Alchemy verified. Web wires when authenticated watch addresses exist; otherwise demo banner.',
    href: '/portfolio',
  },
  {
    id: 'prices',
    label: 'Market prices',
    status: 'BETA',
    note: 'Failover CoinGecko → CoinCap → cache. Alchemy Prices when server key present. Never silent seeded-as-live.',
  },
  {
    id: 'activity',
    label: 'Activity',
    status: 'DEMO',
    note: 'Web activity is companion/preview. Mobile on-device activity is authoritative and must not be wiped.',
    href: '/activity',
  },
  {
    id: 'send',
    label: 'Send',
    status: 'DEMO',
    note: 'Premium preview UI. liveBroadcastEnabled=false — no on-chain broadcast. Prefer mobile signing via Reown.',
    href: '/send',
  },
  {
    id: 'receive',
    label: 'Receive',
    status: 'DEMO',
    note: 'allowFundingAddresses=false. Demo addresses; QR/copy locked until funding unlock + real address binding.',
    href: '/receive',
  },
  {
    id: 'auth-web',
    label: 'Web account auth',
    status: 'BETA',
    note: 'Login/register against auth service. Syncs identity/prefs/sessions — never private keys.',
    href: '/auth/login',
  },
  {
    id: 'auth-mobile',
    label: 'Mobile vault auth',
    status: 'LIVE',
    note: 'PIN/biometrics + secure storage on device. Separate from web account until explicit link.',
  },
  {
    id: 'reown-mobile',
    label: 'Reown WalletConnect (mobile)',
    status: 'BETA',
    note: 'WalletKit on Android when WC_PROJECT_ID configured. Do not regress.',
    href: '/web3/pair',
  },
  {
    id: 'reown-web',
    label: 'Reown pairing (web companion)',
    status: 'BETA',
    note: 'Web pairs as dApp/companion; keys stay on mobile. Requires NEXT_PUBLIC_WC_PROJECT_ID (public).',
    href: '/web3/pair',
  },
  {
    id: 'swap',
    label: 'Swap',
    status: 'COMING_SOON',
    note: 'Preview quotes only; broadcast off.',
    href: '/swap',
  },
  {
    id: 'bridge',
    label: 'Bridge',
    status: 'COMING_SOON',
    note: 'Preview only; broadcast off.',
    href: '/bridge',
  },
  {
    id: 'buy-sell',
    label: 'Buy / Sell',
    status: 'COMING_SOON',
    note: 'Fiat rails not live.',
    href: '/buy',
  },
  {
    id: 'staking',
    label: 'Staking',
    status: 'COMING_SOON',
    note: 'Demo positions only.',
    href: '/staking',
  },
  {
    id: 'hardware',
    label: 'Hardware wallets',
    status: 'COMING_SOON',
    note: 'Simulated pairing UI only.',
    href: '/wallets/hardware',
  },
  {
    id: 'encrypted-backup',
    label: 'Encrypted cross-device wallet-secret sync',
    status: 'COMING_SOON',
    note: 'Account/device foundation only this sprint. Encrypted restoration is a separate security milestone.',
  },
  {
    id: 'biometrics-web',
    label: 'Web biometrics',
    status: 'ABSENT',
    note: 'No WebAuthn unlock on web. Mobile biometrics are device-local.',
  },
  {
    id: 'analytics-ai',
    label: 'Analytics / AI assistant',
    status: 'DEMO',
    note: 'Rule-based assistant + ops analytics — not a live AI product claim.',
    href: '/assistant',
  },
  {
    id: 'nft',
    label: 'NFTs',
    status: 'ABSENT',
    note: 'Permanently removed. Routes redirect to dashboard.',
  },
  {
    id: 'live-broadcast',
    label: 'Live transaction broadcast',
    status: 'ABSENT',
    note: 'Kill switch false on web and mobile. Must remain off.',
  },
];

export function featureById(id: string): FeatureEntry | undefined {
  return FEATURE_CATALOG.find((f) => f.id === id);
}

export function statusLabel(status: FeatureStatus): string {
  switch (status) {
    case 'LIVE':
      return 'Live';
    case 'BETA':
      return 'Beta';
    case 'DEMO':
      return 'Demonstration';
    case 'COMING_SOON':
      return 'Coming soon';
    case 'ABSENT':
      return 'Not available';
    case 'REMOVE':
      return 'Removed';
    default:
      return status;
  }
}
