import type { ChainNetwork, FeePriority } from '@auvora/database';

export type ProviderTxStatus = 'MEMPOOL' | 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface ProviderTx {
  txHash: string;
  fromAddress?: string;
  toAddress?: string;
  amount: string;
  confirmations: number;
  blockNumber?: bigint;
  status: ProviderTxStatus;
}

/**
 * Contract implemented by every chain-specific provider (real or simulated).
 * Application services depend only on this port, never on concrete chains.
 */
export interface BlockchainProvider {
  getChain(): ChainNetwork;
  createAddress(): Promise<{ address: string; metadata?: Record<string, unknown> }>;
  validateAddress(address: string): boolean;
  getBalance(address: string): Promise<string>;
  getBlockHeight(): Promise<bigint>;
  getTransaction(txHash: string): Promise<ProviderTx | null>;
  broadcastTransaction(rawTxHex: string): Promise<{ txHash: string }>;
  estimateFee(priority: FeePriority): Promise<{ amount: string; unit: string }>;
  getNetworkStatus(): Promise<{ healthy: boolean; latencyMs: number; blockHeight: bigint }>;
  getConfirmations(txHash: string): Promise<number>;
  watchAddress(address: string): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }>;
}
