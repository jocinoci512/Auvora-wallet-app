import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type AnalyticsAuditRecord,
  type Prisma,
} from '@auvora/database';

export interface AuditRecordOptions {
  actorUserId?: string;
  subjectUserId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(action: string, options: AuditRecordOptions = {}): Promise<AnalyticsAuditRecord> {
    return this.prisma.analyticsAuditRecord.create({
      data: {
        action,
        actorUserId: options.actorUserId,
        subjectUserId: options.subjectUserId,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        details: (options.details ?? {}) as Prisma.InputJsonValue,
        correlationId: options.correlationId,
      },
    });
  }

  async list(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.analyticsAuditRecord.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.analyticsAuditRecord.count(),
    ]);
    return { items, total };
  }
}
