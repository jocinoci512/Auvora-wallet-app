import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type { Prisma } from '@auvora/database';
import type {
  ProviderRecord,
  ProviderRecordRepositoryPort,
} from '../../application/ports/provider-record-repository.port';

function mapProvider(record: {
  id: string;
  code: string;
  name: string;
  providerType: string;
  isPrimary: boolean;
  isEnabled: boolean;
  priority: number;
  capabilities: unknown;
  endpointUrl: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ProviderRecord {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    providerType: record.providerType,
    isPrimary: record.isPrimary,
    isEnabled: record.isEnabled,
    priority: record.priority,
    capabilities: record.capabilities as ProviderRecord['capabilities'],
    endpointUrl: record.endpointUrl,
    metadata: record.metadata as ProviderRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaProviderRecordRepository implements ProviderRecordRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAll(): Promise<ProviderRecord[]> {
    const records = await this.prisma.paymentProviderRecord.findMany({ orderBy: { priority: 'asc' } });
    return records.map(mapProvider);
  }

  async listEnabled(): Promise<ProviderRecord[]> {
    const records = await this.prisma.paymentProviderRecord.findMany({
      where: { isEnabled: true },
      orderBy: { priority: 'asc' },
    });
    return records.map(mapProvider);
  }

  async findByCode(code: string): Promise<ProviderRecord | null> {
    const record = await this.prisma.paymentProviderRecord.findUnique({ where: { code } });
    return record ? mapProvider(record) : null;
  }

  async upsertByCode(
    code: string,
    data: {
      name: string;
      providerType: string;
      priority?: number;
      isEnabled?: boolean;
      capabilities?: Prisma.InputJsonValue;
    },
  ): Promise<ProviderRecord> {
    const record = await this.prisma.paymentProviderRecord.upsert({
      where: { code },
      create: {
        code,
        name: data.name,
        providerType: data.providerType,
        priority: data.priority ?? 100,
        isEnabled: data.isEnabled ?? true,
        capabilities: data.capabilities,
      },
      update: {
        name: data.name,
        providerType: data.providerType,
        priority: data.priority,
        isEnabled: data.isEnabled,
        capabilities: data.capabilities,
      },
    });
    return mapProvider(record);
  }
}
