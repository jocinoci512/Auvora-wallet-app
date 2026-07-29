import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';

@Injectable()
export class DashboardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async metrics() {
    const [openAlerts, openCases, pendingKyc, providers, rules, recentRisk] = await Promise.all([
      this.prisma.amlAlert.count({ where: { status: 'OPEN' } }),
      this.prisma.complianceCase.count({
        where: { status: { in: ['OPEN', 'ASSIGNED', 'INVESTIGATING'] } },
      }),
      this.prisma.verificationRequest.count({
        where: { status: { in: ['IN_REVIEW', 'SUBMITTED', 'PENDING_PROVIDER'] } },
      }),
      this.prisma.complianceProviderRecord.count({ where: { isEnabled: true } }),
      this.prisma.complianceRule.count({ where: { isEnabled: true } }),
      this.prisma.riskScoreRecord.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      openAlerts,
      openCases,
      pendingKyc,
      enabledProviders: providers,
      enabledRules: rules,
      recentRiskScores: recentRisk.map((r) => ({
        id: r.id,
        ownerUserId: r.ownerUserId,
        score: r.score.toString(),
        band: r.band,
        createdAt: r.createdAt,
      })),
    };
  }

  async listAlerts(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.amlAlert.findMany({ orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.amlAlert.count(),
    ]);
    return { items, total, skip, take };
  }

  async listRules() {
    return this.prisma.complianceRule.findMany({ orderBy: { priority: 'asc' } });
  }

  async listProviders() {
    return this.prisma.complianceProviderRecord.findMany({ orderBy: { priority: 'asc' } });
  }

  async listSanctions(skip = 0, take = 50) {
    return this.prisma.sanctionsScreeningResult.findMany({
      orderBy: { screenedAt: 'desc' },
      skip,
      take,
    });
  }

  async listPep(skip = 0, take = 50) {
    return this.prisma.pepScreeningResult.findMany({
      orderBy: { screenedAt: 'desc' },
      skip,
      take,
    });
  }

  async listDocuments(skip = 0, take = 50) {
    return this.prisma.complianceDocument.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async reportsSummary() {
    const [approved, rejected, alerts, cases] = await Promise.all([
      this.prisma.verificationRequest.count({ where: { status: 'APPROVED' } }),
      this.prisma.verificationRequest.count({ where: { status: 'REJECTED' } }),
      this.prisma.amlAlert.groupBy({ by: ['severity'], _count: true }),
      this.prisma.complianceCase.groupBy({ by: ['status'], _count: true }),
    ]);
    return { kyc: { approved, rejected }, alertsBySeverity: alerts, casesByStatus: cases };
  }
}
