import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';

@Injectable()
export class LoggingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async search(filters: {
    serviceName?: string;
    level?: string;
    correlationId?: string;
    take?: number;
    skip?: number;
  } = {}) {
    const where = {
      ...(filters.serviceName ? { serviceName: filters.serviceName } : {}),
      ...(filters.level ? { level: filters.level } : {}),
      ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.obsLogEntry.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
      }),
      this.prisma.obsLogEntry.count({ where }),
    ]);
    return { items, total };
  }
}
