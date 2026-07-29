import { ConflictError, NotFoundError } from '../../domain';
import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  const clock = { now: jest.fn().mockReturnValue(new Date('2026-07-26T12:00:00.000Z')) };

  beforeEach(() => jest.clearAllMocks());

  it('lists metric definitions', async () => {
    const prisma = {
      metricDefinition: {
        findMany: jest.fn().mockResolvedValue([{ code: 'dau' }]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      metricValue: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    };
    const service = new MetricsService(prisma as never, clock as never);
    const metrics = await service.listDefinitions({ enabledOnly: true });
    expect(metrics).toHaveLength(1);
  });

  it('throws when metric definition missing', async () => {
    const prisma = {
      metricDefinition: {
        findMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      metricValue: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    };
    const service = new MetricsService(prisma as never, clock as never);
    await expect(service.getDefinition('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('creates metric definition', async () => {
    const prisma = {
      metricDefinition: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ code: 'custom_metric' }),
      },
      metricValue: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    };
    const service = new MetricsService(prisma as never, clock as never);
    const metric = await service.create({
      code: 'custom_metric',
      name: 'Custom Metric',
      domain: 'SYSTEM',
      valueType: 'COUNTER',
    });
    expect(metric.code).toBe('custom_metric');
  });

  it('throws conflict when metric already exists', async () => {
    const prisma = {
      metricDefinition: {
        findUnique: jest.fn().mockResolvedValue({ code: 'dau' }),
      },
      metricValue: { findMany: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
    };
    const service = new MetricsService(prisma as never, clock as never);
    await expect(
      service.create({ code: 'dau', name: 'DAU', domain: 'CUSTOMER', valueType: 'GAUGE' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('loads metric values for a code', async () => {
    const prisma = {
      metricDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', code: 'dau' }),
      },
      metricValue: {
        findMany: jest.fn().mockResolvedValue([{ value: 10 }]),
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    };
    const service = new MetricsService(prisma as never, clock as never);
    const values = await service.getValues('dau', { window: 'DAILY' });
    expect(values[0]?.value).toBe(10);
  });

  it('records duration samples', async () => {
    const prisma = {
      metricDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', code: 'dashboard_load_ms' }),
      },
      metricValue: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new MetricsService(prisma as never, clock as never);
    await service.recordDuration('dashboard_load_ms', 42);
    expect(prisma.metricValue.upsert).toHaveBeenCalled();
  });

  it('loads latest metric value', async () => {
    const prisma = {
      metricDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', code: 'dau' }),
      },
      metricValue: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({ value: 42, sampleCount: 1 }),
        upsert: jest.fn(),
      },
    };
    const service = new MetricsService(prisma as never, clock as never);
    const latest = await service.getLatestValue('dau');
    expect(latest?.value).toBe(42);
  });

  it('returns performance summary', async () => {
    const prisma = {
      metricDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', code: 'dashboard_load_ms' }),
      },
      metricValue: {
        findMany: jest.fn(),
        findFirst: jest
          .fn()
          .mockResolvedValue({ value: 100, sampleCount: 2, bucketStart: new Date() }),
        upsert: jest.fn(),
      },
    };
    const service = new MetricsService(prisma as never, clock as never);
    const summary = await service.getPerformanceSummary();
    expect(summary).toHaveLength(3);
    expect(summary[0]?.latestValueMs).toBe(50);
  });
});
