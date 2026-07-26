import type { ChainAddressStatus, ChainNetwork, Prisma } from '@auvora/database';

export const CHAIN_ADDRESS_REPOSITORY = Symbol('CHAIN_ADDRESS_REPOSITORY');

export interface ChainAddressRecord {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  walletId: string | null;
  ownerUserId: string;
  address: string;
  label: string | null;
  isPrimary: boolean;
  status: ChainAddressStatus;
  watched: boolean;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  activatedAt: Date | null;
  archivedAt: Date | null;
}

export interface CreateChainAddressData {
  chain: ChainNetwork;
  networkId: string;
  walletId?: string | null;
  ownerUserId: string;
  address: string;
  label?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateChainAddressData {
  label?: string | null;
  metadata?: Prisma.InputJsonValue;
  watched?: boolean;
}

export interface ChainAddressFilters {
  ownerUserId?: string;
  chain?: ChainNetwork;
  status?: ChainAddressStatus;
  skip?: number;
  take?: number;
}

export interface ChainAddressRepositoryPort {
  create(data: CreateChainAddressData): Promise<ChainAddressRecord>;
  findById(id: string): Promise<ChainAddressRecord | null>;
  findByChainAddress(chain: ChainNetwork, address: string): Promise<ChainAddressRecord | null>;
  list(filters: ChainAddressFilters): Promise<{ items: ChainAddressRecord[]; total: number }>;
  update(id: string, data: UpdateChainAddressData): Promise<ChainAddressRecord>;
  setStatus(id: string, status: ChainAddressStatus): Promise<ChainAddressRecord>;
  setPrimary(id: string, ownerUserId: string, chain: ChainNetwork): Promise<ChainAddressRecord>;
  listWatched(chain?: ChainNetwork): Promise<ChainAddressRecord[]>;
}
