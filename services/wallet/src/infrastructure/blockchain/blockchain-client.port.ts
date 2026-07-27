export const BLOCKCHAIN_HTTP_CLIENT = Symbol('BLOCKCHAIN_HTTP_CLIENT');

export type ChainAddressResult = {
  id: string;
  chain: string;
  address: string;
  walletId?: string | null;
  status?: string;
  metadata?: Record<string, unknown> | null;
};

export type ChainBalanceResult = {
  chain: string;
  address: string;
  balance: string;
};

export type ChainNetworkStatusResult = {
  chain: string;
  blockHeight: string;
  healthy: boolean;
  latencyMs: number;
};

export type ChainSyncJobResult = {
  id: string;
  chain: string;
  type?: string;
  status?: string;
};

/**
 * HTTP client for the blockchain service — system of record for chain addresses,
 * balances, transactions, and network status. Wallet Core never talks to Alchemy.
 */
export interface BlockchainHttpClientPort {
  isConfigured(): boolean;

  validateAddress(chain: string, address: string): Promise<boolean>;

  createAddress(input: {
    chain: string;
    ownerUserId: string;
    walletId?: string;
    label?: string;
  }): Promise<ChainAddressResult | null>;

  getBalance(chain: string, address: string): Promise<ChainBalanceResult | null>;

  getNetworkStatus(chain: string): Promise<ChainNetworkStatusResult | null>;

  triggerSync(chain: string): Promise<ChainSyncJobResult | null>;

  listChains(): Promise<string[]>;
}
