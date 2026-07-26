import { Inject, Injectable } from '@nestjs/common';
import { type ChainNetwork, PrismaService } from '@auvora/database';
import type {
  ProviderRecord,
  ProviderRecordRepositoryPort,
} from '../../application/ports/provider-record-repository.port';

function mapProviderRecord(record: {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  code: string;
  name: string;
  isPrimary: boolean;
  isEnabled: boolean;
  endpointUrl: string | null;
  priority: number;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ProviderRecord {
  return {
    id: record.id,
    chain: record.chain,
    networkId: record.networkId,
    code: record.code,
    name: record.name,
    isPrimary: record.isPrimary,
    isEnabled: record.isEnabled,
    endpointUrl: record.endpointUrl,
    priority: record.priority,
    metadata: record.metadata as ProviderRecord['metadata'],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

@Injectable()
export class PrismaProviderRecordRepository implements ProviderRecordRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAll(): Promise<ProviderRecord[]> {
    const records = await this.prisma.blockchainProviderRecord.findMany({
      orderBy: [{ chain: 'asc' }, { priority: 'asc' }],
    });
    return records.map(mapProviderRecord);
  }

  async listByChain(chain: ChainNetwork): Promise<ProviderRecord[]> {
    const records = await this.prisma.blockchainProviderRecord.findMany({
      where: { chain },
      orderBy: { priority: 'asc' },
    });
    return records.map(mapProviderRecord);
  }

  async findPrimary(chain: ChainNetwork): Promise<ProviderRecord | null> {
    const record = await this.prisma.blockchainProviderRecord.findFirst({
      where: { chain, isPrimary: true, isEnabled: true },
      orderBy: { priority: 'asc' },
    });
    return record ? mapProviderRecord(record) : null;
  }
}
