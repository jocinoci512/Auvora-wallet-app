import { Inject, Injectable } from '@nestjs/common';
import { type ChainNetwork, PrismaService } from '@auvora/database';
import type {
  ProviderHealthFilters,
  ProviderHealthRecord,
  ProviderHealthRepositoryPort,
  RecordProviderHealthData,
} from '../../application/ports/provider-health-repository.port';

function mapHealth(record: {
  id: string;
  chain: ChainNetwork;
  networkId: string;
  providerId: string | null;
  status: string;
  latencyMs: number | null;
  blockHeight: bigint | null;
  errorMessage: string | null;
  checkedAt: Date;
}): ProviderHealthRecord {
  return {
    id: record.id,
    chain: record.chain,
    networkId: record.networkId,
    providerId: record.providerId,
    status: record.status,
    latencyMs: record.latencyMs,
    blockHeight: record.blockHeight !== null ? record.blockHeight.toString() : null,
    errorMessage: record.errorMessage,
    checkedAt: record.checkedAt,
  };
}

@Injectable()
export class PrismaProviderHealthRepository implements ProviderHealthRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(data: RecordProviderHealthData): Promise<ProviderHealthRecord> {
    const record = await this.prisma.providerHealthSnapshot.create({
      data: {
        chain: data.chain,
        networkId: data.networkId,
        providerId: data.providerId ?? null,
        status: data.status,
        latencyMs: data.latencyMs,
        blockHeight: data.blockHeight !== undefined ? BigInt(data.blockHeight) : undefined,
        errorMessage: data.errorMessage,
      },
    });
    return mapHealth(record);
  }

  async latestByChain(): Promise<ProviderHealthRecord[]> {
    const chains = await this.prisma.providerHealthSnapshot.groupBy({
      by: ['chain'],
      _max: { checkedAt: true },
    });

    const results: ProviderHealthRecord[] = [];
    for (const entry of chains) {
      if (!entry._max.checkedAt) {
        continue;
      }
      const record = await this.prisma.providerHealthSnapshot.findFirst({
        where: { chain: entry.chain, checkedAt: entry._max.checkedAt },
        orderBy: { checkedAt: 'desc' },
      });
      if (record) {
        results.push(mapHealth(record));
      }
    }
    return results;
  }

  async list(filters: ProviderHealthFilters): Promise<{ items: ProviderHealthRecord[]; total: number }> {
    const where = { ...(filters.chain ? { chain: filters.chain } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.providerHealthSnapshot.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { checkedAt: 'desc' },
      }),
      this.prisma.providerHealthSnapshot.count({ where }),
    ]);
    return { items: items.map(mapHealth), total };
  }
}
