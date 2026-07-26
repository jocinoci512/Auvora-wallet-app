import type { ChainNetwork, Prisma } from '@auvora/database';

export const PROVIDER_RECORD_REPOSITORY = Symbol('PROVIDER_RECORD_REPOSITORY');

export interface ProviderRecord {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  code: string;
  name: string;
  isPrimary: boolean;
  isEnabled: boolean;
  endpointUrl: string | null;
  priority: number;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderRecordRepositoryPort {
  listAll(): Promise<ProviderRecord[]>;
  listByChain(chain: ChainNetwork): Promise<ProviderRecord[]>;
  findPrimary(chain: ChainNetwork): Promise<ProviderRecord | null>;
}
