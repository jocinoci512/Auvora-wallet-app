import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type AiAuditRecord, type Prisma } from '@auvora/database';

export interface AuditRecordOptions {
  actorUserId?: string;
  subjectUserId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  correlationId?: string;
}

/**
 * Central write path for `ai_audit_records`. Every governance-sensitive mutation (chat
 * completion/failure, prompt lifecycle transitions, provider config changes, knowledge ingestion)
 * should route through `record` so the admin audit trail (`DashboardService.auditTrail`) stays
 * complete and consistently shaped.
 */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(action: string, options: AuditRecordOptions = {}): Promise<AiAuditRecord> {
    return this.prisma.aiAuditRecord.create({
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
}
