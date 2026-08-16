/**
 * Canonical visual treatment for networks Auvora actually supports.
 * Do not add speculative chains here.
 */

export type SupportedNetworkId = 'bitcoin' | 'ethereum' | 'solana' | 'bnb' | 'polygon' | 'tron';

export type NetworkVisual = {
  id: SupportedNetworkId;
  label: string;
  symbol: string;
  /** Initials shown in the mark */
  mark: string;
};

export const SUPPORTED_NETWORKS: NetworkVisual[] = [
  { id: 'bitcoin', label: 'Bitcoin', symbol: 'BTC', mark: '₿' },
  { id: 'ethereum', label: 'Ethereum', symbol: 'ETH', mark: 'Ξ' },
  { id: 'solana', label: 'Solana', symbol: 'SOL', mark: 'S' },
  { id: 'bnb', label: 'BNB Smart Chain', symbol: 'BNB', mark: 'B' },
  { id: 'polygon', label: 'Polygon', symbol: 'POL', mark: 'P' },
  { id: 'tron', label: 'Tron', symbol: 'TRX', mark: 'T' },
];

const ALIASES: Record<string, SupportedNetworkId> = {
  bitcoin: 'bitcoin',
  btc: 'bitcoin',
  ethereum: 'ethereum',
  eth: 'ethereum',
  ether: 'ethereum',
  solana: 'solana',
  sol: 'solana',
  bnb: 'bnb',
  bsc: 'bnb',
  'bnb smart chain': 'bnb',
  bnb_smart_chain: 'bnb',
  polygon: 'polygon',
  matic: 'polygon',
  pol: 'polygon',
  tron: 'tron',
  trx: 'tron',
};

export function resolveNetwork(raw: string | null | undefined): NetworkVisual | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase().replace(/[_-]+/g, ' ');
  const compact = key.replace(/\s+/g, ' ');
  const id = ALIASES[compact] ?? ALIASES[compact.replace(/\s/g, '_')];
  if (!id) return null;
  return SUPPORTED_NETWORKS.find((n) => n.id === id) ?? null;
}

export function networkLabel(raw: string): string {
  return resolveNetwork(raw)?.label ?? raw;
}
