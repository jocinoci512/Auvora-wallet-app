import type { ActivityTx } from './types';

/** Curated demo history used when gateway txs are unavailable. */
export const DEMO_ACTIVITY: ActivityTx[] = [
  {
    id: 'tx-1',
    hash: '0x8f3a2c1b9e7d6a5f4c3b2a1908f7e6d5c4b3a291807f6e5d4c3b2a19',
    direction: 'receive',
    status: 'confirmed',
    network: 'ethereum',
    asset: 'ETH',
    amount: '0.50',
    amountUsd: 1710,
    fee: '0.0012',
    feeUsd: 4.1,
    from: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    to: '0xYourDailySpend…',
    timestamp: new Date(Date.now() - 2 * 3600_000).toISOString(),
    explorerUrl: 'https://etherscan.io/tx/0x8f3a',
    walletLabel: 'Daily spend',
  },
  {
    id: 'tx-2',
    hash: '5Kj8…nPq2',
    direction: 'swap',
    status: 'confirmed',
    network: 'solana',
    asset: 'SOL',
    amount: '12.0',
    amountUsd: 1778,
    fee: '0.00005',
    feeUsd: 0.01,
    from: 'Daily spend',
    to: 'USDC',
    timestamp: new Date(Date.now() - 26 * 3600_000).toISOString(),
    note: 'SOL → USDC',
    explorerUrl: 'https://solscan.io/tx/5Kj8',
    walletLabel: 'Daily spend',
  },
  {
    id: 'tx-3',
    hash: '0xab12cd34ef56…',
    direction: 'stake',
    status: 'pending',
    network: 'ethereum',
    asset: 'ETH',
    amount: '1.00',
    amountUsd: 3420,
    fee: '0.002',
    feeUsd: 6.8,
    from: 'Daily spend',
    to: 'Lido',
    timestamp: new Date(Date.now() - 30 * 3600_000).toISOString(),
    explorerUrl: 'https://etherscan.io/tx/0xab12',
    walletLabel: 'Daily spend',
  },
  {
    id: 'tx-4',
    hash: '0xbridge…250',
    direction: 'bridge',
    status: 'confirmed',
    network: 'ethereum',
    asset: 'USDC',
    amount: '250',
    amountUsd: 250,
    fee: '2.40',
    feeUsd: 2.4,
    from: 'ethereum',
    to: 'solana',
    timestamp: new Date(Date.now() - 3 * 86400_000).toISOString(),
    explorerUrl: 'https://etherscan.io/tx/0xbridge',
    walletLabel: 'Daily spend',
  },
  {
    id: 'tx-5',
    hash: 'bctc1…send',
    direction: 'send',
    status: 'confirmed',
    network: 'bitcoin',
    asset: 'BTC',
    amount: '0.01',
    amountUsd: 684,
    fee: '0.00012',
    feeUsd: 8.2,
    from: 'Cold vault',
    to: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    timestamp: new Date(Date.now() - 5 * 86400_000).toISOString(),
    explorerUrl: 'https://mempool.space/tx/bctc1',
    walletLabel: 'Cold vault',
  },
  {
    id: 'tx-6',
    hash: '0xfail…99',
    direction: 'send',
    status: 'failed',
    network: 'ethereum',
    asset: 'ETH',
    amount: '0.08',
    amountUsd: 273,
    fee: '0.003',
    feeUsd: 10.2,
    from: 'Daily spend',
    to: '0xDead…Beef',
    timestamp: new Date(Date.now() - 7 * 86400_000).toISOString(),
    note: 'Insufficient gas',
    explorerUrl: 'https://etherscan.io/tx/0xfail',
    walletLabel: 'Daily spend',
  },
];

export function groupActivityByDay(items: ActivityTx[]): { label: string; items: ActivityTx[] }[] {
  const map = new Map<string, ActivityTx[]>();
  for (const tx of items) {
    const d = new Date(tx.timestamp);
    const key = d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const bucket = map.get(key) ?? [];
    bucket.push(tx);
    map.set(key, bucket);
  }
  return Array.from(map.entries()).map(([label, group]) => ({ label, items: group }));
}

export function exportActivityCsv(items: ActivityTx[]): string {
  const header = [
    'id',
    'hash',
    'direction',
    'status',
    'network',
    'asset',
    'amount',
    'amountUsd',
    'fee',
    'from',
    'to',
    'timestamp',
  ];
  const rows = items.map((t) =>
    [
      t.id,
      t.hash,
      t.direction,
      t.status,
      t.network,
      t.asset,
      t.amount,
      t.amountUsd,
      t.fee ?? '',
      t.from,
      t.to,
      t.timestamp,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  return [header.join(','), ...rows].join('\n');
}
