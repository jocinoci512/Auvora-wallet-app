import type { ChainNetwork, Prisma } from '@auvora/database';

export const NETWORK_CONFIG_REPOSITORY = Symbol('NETWORK_CONFIG_REPOSITORY');

export interface NetworkConfigRecord {
  id: string;
  chain: ChainNetwork;
  displayName: string;
  isEnabled: boolean;
  requiredConfirmations: number;
  blockTimeSeconds: number;
  nativeSymbol: string;
  explorerUrl: string | null;
  rpcUrl: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NetworkConfigRepositoryPort {
  findByChain(chain: ChainNetwork): Promise<NetworkConfigRecord | null>;
  listAll(): Promise<NetworkConfigRecord[]>;
  listEnabled(): Promise<NetworkConfigRecord[]>;
}
