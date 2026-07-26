import type { ChainNetwork } from '@auvora/database';

export const CHAIN_BLOCK_REPOSITORY = Symbol('CHAIN_BLOCK_REPOSITORY');

export interface ChainBlockRecord {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  height: string;
  hash: string;
  parentHash: string | null;
  timestamp: Date;
  isOrphan: boolean;
  syncedAt: Date;
}

export interface CreateChainBlockData {
  chain: ChainNetwork;
  networkId: string;
  height: string;
  hash: string;
  parentHash?: string | null;
  timestamp: Date;
  isOrphan?: boolean;
}

export interface ChainBlockFilters {
  chain?: ChainNetwork;
  skip?: number;
  take?: number;
}

export interface ChainBlockRepositoryPort {
  create(data: CreateChainBlockData): Promise<ChainBlockRecord>;
  findLatest(chain: ChainNetwork): Promise<ChainBlockRecord | null>;
  list(filters: ChainBlockFilters): Promise<{ items: ChainBlockRecord[]; total: number }>;
  markOrphan(id: string): Promise<ChainBlockRecord>;
}
