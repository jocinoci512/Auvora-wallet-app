import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type InfraBackupStatus,
  type InfraComponentKind,
  type InfraDeploymentStatus,
  type InfraDeploymentStrategy,
  type InfraEnvironmentCode,
  type Prisma,
} from '@auvora/database';

@Injectable()
export class InfrastructureService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listEnvironments() {
    return this.prisma.infraEnvironment.findMany({ orderBy: { code: 'asc' } });
  }

  async listDeployments(environmentCode?: InfraEnvironmentCode, take = 50) {
    const where = environmentCode ? { environmentCode } : undefined;
    const [items, total] = await Promise.all([
      this.prisma.infraDeployment.findMany({
        where,
        take,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.infraDeployment.count({ where }),
    ]);
    return { items, total };
  }

  async listBackups(environmentCode?: InfraEnvironmentCode, take = 50) {
    const where = environmentCode ? { environmentCode } : undefined;
    const [items, total] = await Promise.all([
      this.prisma.infraBackupJob.findMany({
        where,
        take,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.infraBackupJob.count({ where }),
    ]);
    return { items, total };
  }

  async listRecoveryDrills(environmentCode?: InfraEnvironmentCode, take = 50) {
    const where = environmentCode ? { environmentCode } : undefined;
    const [items, total] = await Promise.all([
      this.prisma.infraRecoveryDrill.findMany({
        where,
        take,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.infraRecoveryDrill.count({ where }),
    ]);
    return { items, total };
  }

  async listFeatureFlags(environmentCode?: InfraEnvironmentCode) {
    const where = environmentCode ? { environmentCode } : undefined;
    return this.prisma.featureFlag.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async createDeployment(input: {
    environmentCode: InfraEnvironmentCode;
    version: string;
    strategy: InfraDeploymentStrategy;
    actorUserId?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  }) {
    const deployment = await this.prisma.infraDeployment.create({
      data: {
        environmentCode: input.environmentCode,
        version: input.version,
        strategy: input.strategy,
        status: 'IN_PROGRESS',
        actorUserId: input.actorUserId,
        notes: input.notes,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.recordAudit('deployment.started', input.actorUserId, {
      deploymentId: deployment.id,
      environmentCode: input.environmentCode,
      version: input.version,
    });
    return deployment;
  }

  async recordBackup(input: {
    environmentCode: InfraEnvironmentCode;
    componentKind: InfraComponentKind;
    componentName: string;
    status?: InfraBackupStatus;
    actorUserId?: string;
    location?: string;
    checksum?: string;
    metadata?: Record<string, unknown>;
  }) {
    const status = input.status ?? 'RUNNING';
    const completedAt = status === 'SUCCEEDED' || status === 'VERIFIED' ? new Date() : undefined;
    const verifiedAt = status === 'VERIFIED' ? new Date() : undefined;
    const backup = await this.prisma.infraBackupJob.create({
      data: {
        environmentCode: input.environmentCode,
        componentKind: input.componentKind,
        componentName: input.componentName,
        status,
        completedAt,
        verifiedAt,
        location: input.location,
        checksum: input.checksum,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.recordAudit('backup.recorded', input.actorUserId, {
      backupId: backup.id,
      environmentCode: input.environmentCode,
      componentName: input.componentName,
      status,
    });
    return backup;
  }

  async startRecoveryDrill(input: {
    environmentCode: InfraEnvironmentCode;
    name: string;
    actorUserId?: string;
    notes?: string;
    rtoMinutes?: number;
    rpoMinutes?: number;
    metadata?: Record<string, unknown>;
  }) {
    const drill = await this.prisma.infraRecoveryDrill.create({
      data: {
        environmentCode: input.environmentCode,
        name: input.name,
        status: 'IN_PROGRESS',
        notes: input.notes,
        rtoMinutes: input.rtoMinutes,
        rpoMinutes: input.rpoMinutes,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
    await this.recordAudit('recovery_drill.started', input.actorUserId, {
      drillId: drill.id,
      environmentCode: input.environmentCode,
      name: input.name,
    });
    return drill;
  }

  async updateFeatureFlag(
    code: string,
    input: {
      enabled?: boolean;
      description?: string;
      metadata?: Record<string, unknown>;
      actorUserId?: string;
    },
  ) {
    const flag = await this.prisma.featureFlag.update({
      where: { code },
      data: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
    await this.recordAudit('feature_flag.updated', input.actorUserId, {
      code,
      enabled: flag.enabled,
    });
    return flag;
  }

  async clusterHealth() {
    const [environments, recentDeployments, recentBackups, activeDrills] = await Promise.all([
      this.prisma.infraEnvironment.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.infraDeployment.findMany({ take: 5, orderBy: { startedAt: 'desc' } }),
      this.prisma.infraBackupJob.findMany({ take: 5, orderBy: { startedAt: 'desc' } }),
      this.prisma.infraRecoveryDrill.findMany({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        take: 5,
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const failedDeployments = recentDeployments.filter((d) => d.status === 'FAILED').length;
    const verifiedBackups = recentBackups.filter((b) => b.status === 'VERIFIED').length;
    const status =
      failedDeployments > 0 || activeDrills.length > 0
        ? 'DEGRADED'
        : environments.some((e) => e.isActive)
          ? 'HEALTHY'
          : 'UNKNOWN';

    return {
      generatedAt: new Date().toISOString(),
      status,
      activeEnvironmentCount: environments.filter((e) => e.isActive).length,
      recentFailedDeployments: failedDeployments,
      recentVerifiedBackups: verifiedBackups,
      activeRecoveryDrills: activeDrills.length,
      environments: environments.map((e) => ({
        code: e.code,
        name: e.name,
        isActive: e.isActive,
      })),
      notes:
        'Cluster health aggregates infra control-plane records. Live kube metrics are provided by the Observability platform.',
    };
  }

  async dashboardSummary() {
    const [
      environments,
      recentDeployments,
      recentBackups,
      activeDrills,
      featureFlags,
      deploymentCounts,
      backupCounts,
    ] = await Promise.all([
      this.prisma.infraEnvironment.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.infraDeployment.findMany({ take: 10, orderBy: { startedAt: 'desc' } }),
      this.prisma.infraBackupJob.findMany({ take: 10, orderBy: { startedAt: 'desc' } }),
      this.prisma.infraRecoveryDrill.findMany({
        where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
        take: 10,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.featureFlag.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.infraDeployment.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.infraBackupJob.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const activeEnvironmentCount = environments.filter((env) => env.isActive).length;
    const enabledFeatureFlagCount = featureFlags.filter((flag) => flag.enabled).length;

    return {
      generatedAt: new Date().toISOString(),
      activeEnvironmentCount,
      enabledFeatureFlagCount,
      environments,
      recentDeployments,
      recentBackups,
      activeDrills,
      featureFlags,
      deploymentCounts: Object.fromEntries(
        deploymentCounts.map((row) => [row.status, row._count._all]),
      ) as Partial<Record<InfraDeploymentStatus, number>>,
      backupCounts: Object.fromEntries(
        backupCounts.map((row) => [row.status, row._count._all]),
      ) as Partial<Record<InfraBackupStatus, number>>,
    };
  }

  private async recordAudit(
    action: string,
    actorUserId: string | undefined,
    details: Record<string, unknown>,
  ) {
    await this.prisma.infraAuditRecord.create({
      data: {
        action,
        actorUserId,
        details: details as Prisma.InputJsonValue,
      },
    });
  }
}
