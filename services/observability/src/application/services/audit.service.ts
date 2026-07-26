import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type Prisma } from '@auvora/database';

export interface AuditRecordOptions {
  actorUserId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(action: string, options: AuditRecordOptions = {}) {
    return this.prisma.obsAuditRecord.create({
      data: {
        action,
        actorUserId: options.actorUserId,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        details: (options.details ?? {}) as Prisma.InputJsonValue,
        correlationId: options.correlationId,
      },
    });
  }

  async list(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.obsAuditRecord.findMany({ skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.obsAuditRecord.count(),
    ]);
    return { items, total };
  }
}
