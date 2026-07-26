import type { ChainNetwork } from '@auvora/database';

export const PROVIDER_HEALTH_REPOSITORY = Symbol('PROVIDER_HEALTH_REPOSITORY');

export interface ProviderHealthRecord {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  providerId: string | null;
  status: string;
  latencyMs: number | null;
  blockHeight: string | null;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface RecordProviderHealthData {
  chain: ChainNetwork;
  networkId: string;
  providerId?: string | null;
  status: string;
  latencyMs?: number;
  blockHeight?: string;
  errorMessage?: string;
}

export interface ProviderHealthFilters {
  chain?: ChainNetwork;
  skip?: number;
  take?: number;
}

export interface ProviderHealthRepositoryPort {
  record(data: RecordProviderHealthData): Promise<ProviderHealthRecord>;
  latestByChain(): Promise<ProviderHealthRecord[]>;
  list(filters: ProviderHealthFilters): Promise<{ items: ProviderHealthRecord[]; total: number }>;
}
