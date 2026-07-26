import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type {
  EventLogFilters,
  EventLogRecord,
  EventLogRepositoryPort,
} from '../../application/ports/event-log-repository.port';

@Injectable()
export class PrismaEventLogRepository implements EventLogRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(filters: EventLogFilters): Promise<{ items: EventLogRecord[]; total: number }> {
    const where = {
      ...(filters.eventType ? { eventType: filters.eventType } : {}),
      ...(filters.aggregateId ? { aggregateId: filters.aggregateId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.paymentEventLog.findMany({
        where,
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.paymentEventLog.count({ where }),
    ]);
    return { items, total };
  }
}
