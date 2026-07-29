import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async metrics() {
    const [
      activeKeys,
      revokedKeys,
      pendingSigning,
      pendingApprovals,
      pendingRecovery,
      enabledProviders,
      enabledPolicies,
      recentViolations,
    ] = await Promise.all([
      this.prisma.cryptographicKey.count({ where: { status: 'ACTIVE' } }),
      this.prisma.cryptographicKey.count({ where: { status: { in: ['REVOKED', 'DESTROYED'] } } }),
      this.prisma.signingRequest.count({
        where: { status: { in: ['QUEUED', 'SCHEDULED', 'SIGNING'] } },
      }),
      this.prisma.signingRequest.count({ where: { status: 'AWAITING_APPROVAL' } }),
      this.prisma.recoveryRequest.count({
        where: { status: { in: ['PENDING', 'AWAITING_APPROVAL', 'APPROVED'] } },
      }),
      this.prisma.custodyProviderRecord.count({ where: { isEnabled: true } }),
      this.prisma.transactionPolicy.count({ where: { isEnabled: true } }),
      this.prisma.custodyPolicyViolation.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      activeKeys,
      revokedKeys,
      pendingSigning,
      pendingApprovals,
      pendingRecovery,
      enabledProviders,
      enabledPolicies,
      recentViolations,
    };
  }

  async listProviders() {
    return this.prisma.custodyProviderRecord.findMany({ orderBy: { priority: 'asc' } });
  }

  async auditTrailForUser(userId: string, skip = 0, take = 50) {
    const where = { subjectUserId: userId };
    const [items, total] = await Promise.all([
      this.prisma.custodyAuditRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 200),
      }),
      this.prisma.custodyAuditRecord.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async auditTrail(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.custodyAuditRecord.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 200),
      }),
      this.prisma.custodyAuditRecord.count(),
    ]);
    return { items, total, skip, take };
  }

  async policyViolations(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.custodyPolicyViolation.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 200),
      }),
      this.prisma.custodyPolicyViolation.count(),
    ]);
    return { items, total, skip, take };
  }
}
