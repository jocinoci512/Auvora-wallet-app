/** Shared types for Task 029 premium wallet experience (client UX layer). */

export type WalletNetwork = 'bitcoin' | 'ethereum' | 'solana' | 'polygon' | 'bnb' | 'tron';

export type WalletAsset = 'BTC' | 'ETH' | 'SOL' | 'MATIC' | 'BNB' | 'TRX' | 'USDC' | 'USDT';

export type FeeSpeed = 'slow' | 'standard' | 'fast' | 'custom';

export type TxStatus = 'pending' | 'confirmed' | 'failed' | 'dropped';

export type TxDirection = 'send' | 'receive' | 'swap' | 'stake' | 'bridge' | 'contract';

export interface AddressContact {
  id: string;
  name: string;
  address: string;
  network: WalletNetwork;
  note?: string;
  favorite: boolean;
  group?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface ActivityTx {
  id: string;
  hash: string;
  direction: TxDirection;
  status: TxStatus;
  network: WalletNetwork;
  asset: WalletAsset;
  amount: string;
  amountUsd: number;
  fee?: string;
  feeUsd?: number;
  from: string;
  to: string;
  timestamp: string;
  note?: string;
  explorerUrl: string;
  walletLabel?: string;
}

export interface SecurityPrefs {
  pinEnabled: boolean;
  /** SHA-256 hex of PIN — never store raw PIN */
  pinHash: string | null;
  biometricEnabled: boolean;
  autoLockMinutes: number;
  sessionTimeoutMinutes: number;
  backupReminderEnabled: boolean;
  lastBackupReminderAt: string | null;
  suspiciousAddressWarnings: boolean;
  lastUnlockedAt: string | null;
}

export const NETWORKS: { id: WalletNetwork; label: string; asset: WalletAsset }[] = [
  { id: 'bitcoin', label: 'Bitcoin', asset: 'BTC' },
  { id: 'ethereum', label: 'Ethereum', asset: 'ETH' },
  { id: 'solana', label: 'Solana', asset: 'SOL' },
  { id: 'polygon', label: 'Polygon', asset: 'MATIC' },
  { id: 'bnb', label: 'BNB Chain', asset: 'BNB' },
  { id: 'tron', label: 'Tron', asset: 'TRX' },
];

export const TOKENS: { id: WalletAsset; label: string; networks: WalletNetwork[] }[] = [
  { id: 'BTC', label: 'Bitcoin', networks: ['bitcoin'] },
  { id: 'ETH', label: 'Ether', networks: ['ethereum'] },
  { id: 'SOL', label: 'Solana', networks: ['solana'] },
  { id: 'MATIC', label: 'POL', networks: ['polygon'] },
  { id: 'BNB', label: 'BNB', networks: ['bnb'] },
  { id: 'TRX', label: 'TRON', networks: ['tron'] },
  { id: 'USDC', label: 'USD Coin', networks: ['ethereum', 'solana', 'polygon'] },
  { id: 'USDT', label: 'Tether', networks: ['ethereum', 'tron', 'bnb'] },
];
