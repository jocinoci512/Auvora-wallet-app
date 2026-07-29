import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type {
  ProviderHealthFilters,
  ProviderHealthRecord,
  ProviderHealthRepositoryPort,
  RecordProviderHealthData,
} from '../../application/ports/provider-health-repository.port';

function mapHealth(record: {
  id: string;
  providerId: string | null;
  providerCode: string;
  status: string;
  latencyMs: number | null;
  errorMessage: string | null;
  checkedAt: Date;
}): ProviderHealthRecord {
  return {
    id: record.id,
    providerId: record.providerId,
    providerCode: record.providerCode,
    status: record.status,
    latencyMs: record.latencyMs,
    errorMessage: record.errorMessage,
    checkedAt: record.checkedAt,
  };
}

@Injectable()
export class PrismaProviderHealthRepository implements ProviderHealthRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(data: RecordProviderHealthData): Promise<ProviderHealthRecord> {
    const record = await this.prisma.paymentProviderHealthSnapshot.create({
      data: {
        providerId: data.providerId ?? null,
        providerCode: data.providerCode,
        status: data.status,
        latencyMs: data.latencyMs,
        errorMessage: data.errorMessage,
      },
    });
    return mapHealth(record);
  }

  async latestByProvider(): Promise<ProviderHealthRecord[]> {
    const codes = await this.prisma.paymentProviderHealthSnapshot.groupBy({
      by: ['providerCode'],
      _max: { checkedAt: true },
    });

    const results: ProviderHealthRecord[] = [];
    for (const entry of codes) {
      if (!entry._max.checkedAt) {
        continue;
      }
      const record = await this.prisma.paymentProviderHealthSnapshot.findFirst({
        where: { providerCode: entry.providerCode, checkedAt: entry._max.checkedAt },
        orderBy: { checkedAt: 'desc' },
      });
      if (record) {
        results.push(mapHealth(record));
      }
    }
    return results;
  }

  async list(
    filters: ProviderHealthFilters,
  ): Promise<{ items: ProviderHealthRecord[]; total: number }> {
    const where = { ...(filters.providerCode ? { providerCode: filters.providerCode } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.paymentProviderHealthSnapshot.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { checkedAt: 'desc' },
      }),
      this.prisma.paymentProviderHealthSnapshot.count({ where }),
    ]);
    return { items: items.map(mapHealth), total };
  }
}
