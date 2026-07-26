import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { type AuditAction as PrismaAuditAction, type Prisma } from '@auvora/database';
import type {
  AuditRepositoryPort,
  AuditSearchFilters,
  AuditSearchResult,
  CreateAuditLogInput,
} from '../../application/ports/audit-repository.port';

@Injectable()
export class PrismaAuditRepository implements AuditRepositoryPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(input: CreateAuditLogInput): Promise<void> {
    await this.prisma.securityAuditLog.create({
      data: {
        action: input.action as PrismaAuditAction,
        actorUserId: input.actorUserId,
        targetUserId: input.targetUserId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async search(filters: AuditSearchFilters): Promise<AuditSearchResult> {
    const where: Prisma.SecurityAuditLogWhereInput = {};
    if (filters.action) {
      where.action = filters.action as PrismaAuditAction;
    }
    if (filters.actorUserId) {
      where.actorUserId = filters.actorUserId;
    }
    if (filters.targetUserId) {
      where.targetUserId = filters.targetUserId;
    }
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) {
        where.createdAt.gte = filters.from;
      }
      if (filters.to) {
        where.createdAt.lte = filters.to;
      }
    }

    const [logs, total] = await Promise.all([
      this.prisma.securityAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
      }),
      this.prisma.securityAuditLog.count({ where }),
    ]);

    return {
      total,
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action as CreateAuditLogInput['action'],
        actorUserId: log.actorUserId,
        targetUserId: log.targetUserId,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.createdAt,
      })),
    };
  }
}
