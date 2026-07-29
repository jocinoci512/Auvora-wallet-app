/**
 * Demo / fallback data for dashboard & portfolio when APIs are offline.
 * Live fetches prefer market-data + wallet endpoints when authenticated.
 */

export type Holding = {
  id: string;
  symbol: string;
  name: string;
  network: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
  change24hPct: number;
  allocationPct: number;
  costBasisUsd?: number;
  walletId: string;
  walletLabel: string;
};

export type TxPreview = {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'stake' | 'bridge';
  asset: string;
  amount: string;
  status: 'confirmed' | 'pending' | 'failed';
  at: string;
  network: string;
};

export type Mover = {
  symbol: string;
  priceUsd: number;
  change24hPct: number;
};

export type PerformancePoint = {
  t: string;
  v: number;
};

export const DEMO_HOLDINGS: Holding[] = [
  {
    id: 'h-btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    network: 'bitcoin',
    balance: 0.42,
    priceUsd: 68420,
    valueUsd: 28736.4,
    change24hPct: 1.8,
    allocationPct: 38.2,
    costBasisUsd: 24100,
    walletId: 'w1',
    walletLabel: 'Cold vault',
  },
  {
    id: 'h-eth',
    symbol: 'ETH',
    name: 'Ethereum',
    network: 'ethereum',
    balance: 8.15,
    priceUsd: 3420,
    valueUsd: 27873,
    change24hPct: -0.6,
    allocationPct: 37.1,
    costBasisUsd: 25500,
    walletId: 'w2',
    walletLabel: 'Daily spend',
  },
  {
    id: 'h-sol',
    symbol: 'SOL',
    name: 'Solana',
    network: 'solana',
    balance: 126,
    priceUsd: 148.2,
    valueUsd: 18673.2,
    change24hPct: 3.4,
    allocationPct: 24.7,
    costBasisUsd: 15200,
    walletId: 'w2',
    walletLabel: 'Daily spend',
  },
];

export const DEMO_PERFORMANCE: PerformancePoint[] = [
  { t: 'Mon', v: 71200 },
  { t: 'Tue', v: 72140 },
  { t: 'Wed', v: 70880 },
  { t: 'Thu', v: 73420 },
  { t: 'Fri', v: 74110 },
  { t: 'Sat', v: 74890 },
  { t: 'Sun', v: 75282.6 },
];

export const DEMO_TXS: TxPreview[] = [
  {
    id: 'tx1',
    type: 'receive',
    asset: 'ETH',
    amount: '+0.50',
    status: 'confirmed',
    at: '2h ago',
    network: 'ethereum',
  },
  {
    id: 'tx2',
    type: 'swap',
    asset: 'SOL→USDC',
    amount: '12.0 SOL',
    status: 'confirmed',
    at: 'Yesterday',
    network: 'solana',
  },
  {
    id: 'tx3',
    type: 'stake',
    asset: 'ETH',
    amount: '1.00',
    status: 'pending',
    at: 'Yesterday',
    network: 'ethereum',
  },
  {
    id: 'tx4',
    type: 'bridge',
    asset: 'USDC',
    amount: '250',
    status: 'confirmed',
    at: '3d ago',
    network: 'ethereum→solana',
  },
  {
    id: 'tx5',
    type: 'send',
    asset: 'BTC',
    amount: '-0.01',
    status: 'confirmed',
    at: '5d ago',
    network: 'bitcoin',
  },
];

export const DEMO_MOVERS: Mover[] = [
  { symbol: 'SOL', priceUsd: 148.2, change24hPct: 3.4 },
  { symbol: 'BTC', priceUsd: 68420, change24hPct: 1.8 },
  { symbol: 'AVAX', priceUsd: 36.4, change24hPct: 1.1 },
  { symbol: 'ETH', priceUsd: 3420, change24hPct: -0.6 },
  { symbol: 'LINK', priceUsd: 14.2, change24hPct: -1.9 },
];

export const DEMO_WATCHLIST: Mover[] = [
  { symbol: 'BTC', priceUsd: 68420, change24hPct: 1.8 },
  { symbol: 'ETH', priceUsd: 3420, change24hPct: -0.6 },
  { symbol: 'SOL', priceUsd: 148.2, change24hPct: 3.4 },
  { symbol: 'ATOM', priceUsd: 8.9, change24hPct: 0.4 },
];

export function portfolioTotals(holdings: Holding[]) {
  const total = holdings.reduce((s, h) => s + h.valueUsd, 0);
  const day = holdings.reduce((s, h) => s + (h.valueUsd * h.change24hPct) / 100, 0);
  const cost = holdings.reduce((s, h) => s + (h.costBasisUsd ?? h.valueUsd), 0);
  const unrealized = total - cost;
  const wallets = new Set(holdings.map((h) => h.walletId)).size;
  const networks = new Set(holdings.map((h) => h.network)).size;
  return {
    total,
    day,
    dayPct: total ? (day / total) * 100 : 0,
    weekPct: 4.2,
    monthPct: 9.8,
    unrealized,
    unrealizedPct: cost ? (unrealized / cost) * 100 : 0,
    wallets,
    networks,
  };
}

export function formatUsd(n: number, digits = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatPct(n: number, digits = 2): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}%`;
}

/** Deterministic mini sparkline from a seed value (demo / offline). */
export function sparklineFor(seed: number, points = 12): PerformancePoint[] {
  const out: PerformancePoint[] = [];
  let v = seed;
  for (let i = 0; i < points; i++) {
    v = v * (1 + ((Math.sin(seed + i) * 0.008 + (i % 3 === 0 ? 0.004 : -0.002)) as number));
    out.push({ t: String(i), v });
  }
  return out;
}

export type ChartRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';

export function performanceForRange(
  base: PerformancePoint[],
  range: ChartRange,
  totalValue: number,
): PerformancePoint[] {
  const multipliers: Record<ChartRange, number> = {
    '1D': 0.985,
    '1W': 0.96,
    '1M': 0.91,
    '3M': 0.84,
    '1Y': 0.72,
    ALL: 0.55,
  };
  const start = totalValue * multipliers[range];
  const len =
    range === '1D' ? 24 : range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 36 : 48;
  if (base.length >= 5 && range === '1W') return base;
  return Array.from({ length: len }, (_, i) => ({
    t: String(i),
    v:
      start +
      ((totalValue - start) * i) / Math.max(1, len - 1) +
      Math.sin(i / 3) * totalValue * 0.004,
  }));
}

export const DEMO_MARKET_SNAPSHOT = {
  fearGreed: 62,
  fearGreedLabel: 'Greed',
  marketCapT: 2.48,
  btcDominance: 52.4,
  ethGasGwei: 18,
};

export const DEMO_NFT_PREVIEWS = [
  { id: 'n1', name: 'Aura #1204', collection: 'Aether Forms', floorEth: 0.42 },
  { id: 'n2', name: 'Ledger Study', collection: 'Quiet Blocks', floorEth: 0.18 },
  { id: 'n3', name: 'Mist Gate', collection: 'Northern', floorEth: 0.91 },
];

export type DayGroup = { day: string; items: TxPreview[] };

export function groupTxsByDay(txs: TxPreview[]): DayGroup[] {
  const map = new Map<string, TxPreview[]>();
  for (const tx of txs) {
    const day = tx.at.includes('ago') || tx.at === 'Yesterday' ? tx.at : 'Earlier';
    const bucket =
      day.includes('h') || day === 'Just now'
        ? 'Today'
        : day === 'Yesterday'
          ? 'Yesterday'
          : 'Earlier';
    const list = map.get(bucket) ?? [];
    list.push(tx);
    map.set(bucket, list);
  }
  const order = ['Today', 'Yesterday', 'Earlier'];
  return order.filter((d) => map.has(d)).map((day) => ({ day, items: map.get(day)! }));
}
