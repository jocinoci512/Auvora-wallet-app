import { ForbiddenError, NotFoundError } from '../../domain';
import { KpiService } from './kpi.service';

describe('KpiService', () => {
  const metrics = {
    getDefinition: jest.fn().mockResolvedValue({ code: 'dau' }),
    getLatestValue: jest.fn().mockResolvedValue({ value: 95 }),
  };

  beforeEach(() => jest.clearAllMocks());

  it('creates KPI after validating metric exists', async () => {
    const prisma = {
      kpiDefinition: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn().mockResolvedValue({ code: 'kpi.dau' }),
        update: jest.fn(),
      },
    };
    const service = new KpiService(prisma as never, metrics as never);
    const kpi = await service.create({
      code: 'kpi.dau',
      name: 'DAU',
      domain: 'CUSTOMER',
      metricCode: 'dau',
      targetValue: 100,
    });
    expect(kpi.code).toBe('kpi.dau');
  });

  it('evaluates KPI status from latest metric', async () => {
    const prisma = {
      kpiDefinition: {
        findUnique: jest.fn().mockResolvedValue({
          code: 'kpi.dau',
          metricCode: 'dau',
          targetValue: 100,
          warningThreshold: 90,
          criticalThreshold: 80,
          higherIsBetter: true,
        }),
      },
    };
    const service = new KpiService(prisma as never, metrics as never);
    const result = await service.evaluate('kpi.dau');
    expect(result.evaluation.status).toBe('ok');
  });

  it('throws when KPI missing', async () => {
    const prisma = { kpiDefinition: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new KpiService(prisma as never, metrics as never);
    await expect(service.get('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('assertCanManage throws for non-admin', () => {
    const service = new KpiService({} as never, metrics as never);
    expect(() => service.assertCanManage(false)).toThrow(ForbiddenError);
  });
});
