import type { Prisma } from '@auvora/database';

export const PROVIDER_RECORD_REPOSITORY = Symbol('PROVIDER_RECORD_REPOSITORY');

export interface ProviderRecord {
  id: string;
  code: string;
  name: string;
  providerType: string;
  isPrimary: boolean;
  isEnabled: boolean;
  priority: number;
  capabilities: Prisma.JsonValue | null;
  endpointUrl: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderRecordRepositoryPort {
  listAll(): Promise<ProviderRecord[]>;
  listEnabled(): Promise<ProviderRecord[]>;
  findByCode(code: string): Promise<ProviderRecord | null>;
  upsertByCode(
    code: string,
    data: { name: string; providerType: string; priority?: number; isEnabled?: boolean; capabilities?: Prisma.InputJsonValue },
  ): Promise<ProviderRecord>;
}
