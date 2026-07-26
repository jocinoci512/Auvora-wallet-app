import { InfrastructureService } from './infrastructure.service';

describe('InfrastructureService', () => {
  function buildService(overrides: Record<string, unknown> = {}) {
    const prisma = {
      infraEnvironment: {
        findMany: jest.fn().mockResolvedValue([{ code: 'LOCAL', name: 'Local', isActive: true }]),
      },
      infraDeployment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'd1',
          environmentCode: 'LOCAL',
          version: '1.2.0',
          strategy: 'ROLLING',
          status: 'IN_PROGRESS',
        }),
        groupBy: jest.fn().mockResolvedValue([{ status: 'SUCCEEDED', _count: { _all: 1 } }]),
      },
      infraBackupJob: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'b1',
          environmentCode: 'LOCAL',
          componentKind: 'DATABASE',
          componentName: 'postgres',
          status: 'RUNNING',
        }),
        groupBy: jest.fn().mockResolvedValue([{ status: 'SUCCEEDED', _count: { _all: 1 } }]),
      },
      infraRecoveryDrill: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'r1',
          environmentCode: 'LOCAL',
          name: 'Quarterly drill',
          status: 'IN_PROGRESS',
        }),
      },
      featureFlag: {
        findMany: jest.fn().mockResolvedValue([{ code: 'infra.canary_deployments', enabled: true }]),
        update: jest.fn().mockResolvedValue({ code: 'infra.canary_deployments', enabled: false }),
      },
      infraAuditRecord: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
      ...overrides,
    };
    return { service: new InfrastructureService(prisma as never), prisma };
  }

  it('lists environments', async () => {
    const { service, prisma } = buildService();
    const environments = await service.listEnvironments();
    expect(environments).toHaveLength(1);
    expect(prisma.infraEnvironment.findMany).toHaveBeenCalled();
  });

  it('reports cluster health', async () => {
    const { service } = buildService();
    const health = await service.clusterHealth();
    expect(health.status).toBe('HEALTHY');
    expect(health.activeEnvironmentCount).toBe(1);
  });

  it('creates deployment and records audit', async () => {
    const { service, prisma } = buildService();
    const deployment = await service.createDeployment({
      environmentCode: 'LOCAL',
      version: '1.2.0',
      strategy: 'ROLLING',
      actorUserId: 'u1',
    });
    expect(deployment.status).toBe('IN_PROGRESS');
    expect(prisma.infraAuditRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'deployment.started', actorUserId: 'u1' }),
      }),
    );
  });

  it('records backup job', async () => {
    const { service, prisma } = buildService();
    const backup = await service.recordBackup({
      environmentCode: 'LOCAL',
      componentKind: 'DATABASE',
      componentName: 'postgres',
      actorUserId: 'u1',
    });
    expect(backup.status).toBe('RUNNING');
    expect(prisma.infraBackupJob.create).toHaveBeenCalled();
    expect(prisma.infraAuditRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'backup.recorded' }),
      }),
    );
  });

  it('starts recovery drill', async () => {
    const { service, prisma } = buildService();
    const drill = await service.startRecoveryDrill({
      environmentCode: 'LOCAL',
      name: 'Quarterly drill',
      actorUserId: 'u1',
    });
    expect(drill.status).toBe('IN_PROGRESS');
    expect(prisma.infraRecoveryDrill.create).toHaveBeenCalled();
  });

  it('updates feature flag', async () => {
    const { service, prisma } = buildService();
    const flag = await service.updateFeatureFlag('infra.canary_deployments', {
      enabled: false,
      actorUserId: 'u1',
    });
    expect(flag.enabled).toBe(false);
    expect(prisma.featureFlag.update).toHaveBeenCalled();
  });

  it('returns dashboard summary', async () => {
    const { service } = buildService();
    const summary = await service.dashboardSummary();
    expect(summary.activeEnvironmentCount).toBe(1);
    expect(summary.enabledFeatureFlagCount).toBe(1);
    expect(summary.generatedAt).toBeDefined();
  });
});
