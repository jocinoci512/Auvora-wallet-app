import type { ActivityTx } from '../wallet-experience/types';

const KEY = 'auvora_trading_activity_v1';

export type TradingKind = 'swap' | 'bridge' | 'buy' | 'sell' | 'stake' | 'unstake' | 'claim';

export interface TradingActivityItem {
  id: string;
  kind: TradingKind;
  title: string;
  detail: string;
  status: 'pending' | 'confirmed' | 'failed';
  amount: string;
  asset: string;
  timestamp: string;
  href?: string;
}

function read(): TradingActivityItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TradingActivityItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: TradingActivityItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 100)));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function listTradingActivity(): TradingActivityItem[] {
  return read().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function pushTradingActivity(
  input: Omit<TradingActivityItem, 'id' | 'timestamp'> & { id?: string; timestamp?: string },
): TradingActivityItem {
  const item: TradingActivityItem = {
    id: input.id ?? `tr-${crypto.randomUUID().slice(0, 8)}`,
    kind: input.kind,
    title: input.title,
    detail: input.detail,
    status: input.status,
    amount: input.amount,
    asset: input.asset,
    timestamp: input.timestamp ?? new Date().toISOString(),
    href: input.href,
  };
  write([item, ...read()]);
  return item;
}

const WALLET_ASSETS = new Set(['BTC', 'ETH', 'SOL', 'MATIC', 'BNB', 'TRX', 'USDC', 'USDT']);

function toWalletAsset(symbol: string): ActivityTx['asset'] {
  const upper = symbol.toUpperCase();
  return (WALLET_ASSETS.has(upper) ? upper : 'ETH') as ActivityTx['asset'];
}

/** Map trading activity into ActivityTx shape for the shared history experience. */
export function tradingAsActivityTx(
  items: TradingActivityItem[] = listTradingActivity(),
): ActivityTx[] {
  return items.map((t) => ({
    id: t.id,
    hash: t.id,
    direction:
      t.kind === 'buy' || t.kind === 'claim'
        ? 'receive'
        : t.kind === 'swap'
          ? 'swap'
          : t.kind === 'bridge'
            ? 'bridge'
            : t.kind === 'stake' || t.kind === 'unstake'
              ? 'stake'
              : 'send',
    status: t.status === 'failed' ? 'failed' : t.status === 'pending' ? 'pending' : 'confirmed',
    network: 'ethereum',
    asset: toWalletAsset(t.asset),
    amount: t.amount,
    amountUsd: 0,
    from: t.kind,
    to: t.detail,
    timestamp: t.timestamp,
    note: t.title,
    explorerUrl: t.href?.startsWith('http') ? t.href : '/activity',
    walletLabel: 'Trading',
  }));
}

export const DEMO_SWAP_HISTORY = [
  {
    id: 'sw-1',
    pair: 'ETH → USDC',
    amountIn: '0.50 ETH',
    amountOut: '1,705 USDC',
    status: 'confirmed' as const,
    when: '2h ago',
    impact: '0.12%',
  },
  {
    id: 'sw-2',
    pair: 'SOL → USDC',
    amountIn: '12 SOL',
    amountOut: '1,778 USDC',
    status: 'confirmed' as const,
    when: 'Yesterday',
    impact: '0.08%',
  },
  {
    id: 'sw-3',
    pair: 'USDC → ETH',
    amountIn: '500 USDC',
    amountOut: '0.146 ETH',
    status: 'failed' as const,
    when: '3d ago',
    impact: '—',
  },
];

export const DEMO_BRIDGE_HISTORY = [
  {
    id: 'br-1',
    route: 'Ethereum → Solana',
    asset: 'USDC',
    amount: '250',
    provider: 'LayerZero-style',
    status: 'confirmed' as const,
    eta: 'Done',
    when: '3d ago',
  },
  {
    id: 'br-2',
    route: 'Ethereum → BNB',
    asset: 'USDT',
    amount: '100',
    provider: 'Simulator',
    status: 'pending' as const,
    eta: '~8 min',
    when: '1h ago',
  },
];

export const DEMO_BUY_PROVIDERS = [
  { id: 'moonpay', label: 'MoonPay', methods: ['Card', 'Apple Pay'], fee: '1.5% + $0.30' },
  { id: 'ramp', label: 'Ramp', methods: ['Card', 'Bank'], fee: '1.49%' },
  { id: 'stripe', label: 'Stripe Fiat', methods: ['Card'], fee: '2.9% + $0.30' },
  { id: 'ach', label: 'ACH Bank', methods: ['Bank transfer'], fee: '$0.50 flat' },
];

export const DEMO_VALIDATORS = [
  {
    id: 'v1',
    name: 'Auvora Cloud',
    network: 'ethereum',
    apy: 4.12,
    commission: 5,
    status: 'active',
    staked: '128.4k ETH',
  },
  {
    id: 'v2',
    name: 'Northstake',
    network: 'ethereum',
    apy: 3.98,
    commission: 8,
    status: 'active',
    staked: '64.1k ETH',
  },
  {
    id: 'v3',
    name: 'Sol Beacon',
    network: 'solana',
    apy: 6.4,
    commission: 7,
    status: 'active',
    staked: '2.1M SOL',
  },
  {
    id: 'v4',
    name: 'Lido pooled',
    network: 'ethereum',
    apy: 3.7,
    commission: 10,
    status: 'active',
    staked: '9.2M ETH',
  },
];

export const DEMO_REWARD_SERIES = [
  { t: 'Mon', v: 12 },
  { t: 'Tue', v: 14 },
  { t: 'Wed', v: 13.5 },
  { t: 'Thu', v: 16 },
  { t: 'Fri', v: 15.2 },
  { t: 'Sat', v: 17 },
  { t: 'Sun', v: 18.4 },
];
