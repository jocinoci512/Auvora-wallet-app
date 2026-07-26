import { AggregationError } from '../../domain';
import { AggregationService } from './aggregation.service';

describe('AggregationService', () => {
  const clock = { now: jest.fn().mockReturnValue(new Date('2026-07-26T12:00:00.000Z')) };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue({}) };
  const metrics = { recordDuration: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  function buildPrisma(overrides: Record<string, unknown> = {}) {
    return {
      aggregationJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-1' }),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'job-1', ...data }),
        ),
      },
      analyticsEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      metricDefinition: { findMany: jest.fn().mockResolvedValue([]) },
      metricValue: { upsert: jest.fn() },
      ...overrides,
    };
  }

  it('creates a succeeded aggregation job when no events pending', async () => {
    const prisma = buildPrisma();
    const service = new AggregationService(
      prisma as never,
      clock as never,
      events as never,
      audit as never,
      metrics as never,
    );
    const job = await service.run();
    expect(job.status).toBe('SUCCEEDED');
    expect(events.publish).toHaveBeenCalled();
  });

  it('processes pending events with metric snapshots', async () => {
    const prisma = buildPrisma({
      analyticsEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'e1',
            occurredAt: new Date('2026-07-26T10:00:00.000Z'),
            domain: 'WALLET',
            metrics: { dau: 5 },
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
      metricDefinition: {
        findMany: jest.fn().mockResolvedValue([{ id: 'm1', code: 'dau' }]),
      },
      metricValue: { upsert: jest.fn().mockResolvedValue({}) },
    });
    const service = new AggregationService(
      prisma as never,
      clock as never,
      events as never,
      audit as never,
      metrics as never,
    );
    const count = await service.processPendingEvents();
    expect(count).toBe(1);
    expect(prisma.metricValue.upsert).toHaveBeenCalled();
  });

  it('marks job failed when processing throws', async () => {
    const prisma = buildPrisma({
      analyticsEvent: {
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
      },
    });
    const service = new AggregationService(
      prisma as never,
      clock as never,
      events as never,
      audit as never,
      metrics as never,
    );
    await expect(service.run()).rejects.toBeInstanceOf(AggregationError);
    expect(prisma.aggregationJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });
});
