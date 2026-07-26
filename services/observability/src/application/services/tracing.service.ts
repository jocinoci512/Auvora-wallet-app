import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { NotFoundError } from '../../domain';

@Injectable()
export class TracingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async search(filters: { serviceName?: string; correlationId?: string; take?: number } = {}) {
    const take = filters.take ?? 50;
    const [items, total] = await Promise.all([
      this.prisma.obsTrace.findMany({
        where: {
          ...(filters.serviceName ? { rootService: filters.serviceName } : {}),
          ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
        },
        orderBy: { startedAt: 'desc' },
        take,
        include: { spans: { orderBy: { startedAt: 'asc' } } },
      }),
      this.prisma.obsTrace.count({
        where: {
          ...(filters.serviceName ? { rootService: filters.serviceName } : {}),
          ...(filters.correlationId ? { correlationId: filters.correlationId } : {}),
        },
      }),
    ]);
    return { items, total };
  }

  async getByTraceId(traceId: string) {
    const trace = await this.prisma.obsTrace.findUnique({
      where: { traceId },
      include: { spans: { orderBy: { startedAt: 'asc' } } },
    });
    if (!trace) {
      throw new NotFoundError(`Trace ${traceId} not found`);
    }
    const latencyBreakdown = trace.spans.map((span) => ({
      spanId: span.spanId,
      serviceName: span.serviceName,
      operationName: span.operationName,
      durationMs: span.durationMs,
      parentSpanId: span.parentSpanId,
    }));
    return { ...trace, latencyBreakdown, timeline: latencyBreakdown };
  }
}
