export const PROVIDER_HEALTH_REPOSITORY = Symbol('PROVIDER_HEALTH_REPOSITORY');

export interface ProviderHealthRecord {
  id: string;
  providerId: string | null;
  providerCode: string;
  status: string;
  latencyMs: number | null;
  errorMessage: string | null;
  checkedAt: Date;
}

export interface RecordProviderHealthData {
  providerId?: string | null;
  providerCode: string;
  status: string;
  latencyMs?: number;
  errorMessage?: string;
}

export interface ProviderHealthFilters {
  providerCode?: string;
  skip?: number;
  take?: number;
}

export interface ProviderHealthRepositoryPort {
  record(data: RecordProviderHealthData): Promise<ProviderHealthRecord>;
  latestByProvider(): Promise<ProviderHealthRecord[]>;
  list(filters: ProviderHealthFilters): Promise<{ items: ProviderHealthRecord[]; total: number }>;
}
