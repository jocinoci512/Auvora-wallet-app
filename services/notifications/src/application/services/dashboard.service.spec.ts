import { NotFoundError } from '../../domain';
import { DashboardService } from './dashboard.service';

function buildPrismaMock() {
  return {
    notificationMessage: {
      count: jest.fn().mockResolvedValue(3),
    },
    notificationQueueItem: {
      count: jest.fn().mockResolvedValue(2),
    },
    notificationDeliveryLog: {
      aggregate: jest.fn().mockResolvedValue({ _avg: { latencyMs: 42 } }),
      count: jest.fn().mockResolvedValue(10),
    },
    notificationChannelProvider: {
      findMany: jest.fn().mockResolvedValue([{ id: 'p1', priority: 100 }]),
      findUnique: jest.fn().mockResolvedValue({ id: 'p1', priority: 100, isEnabled: true }),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
            Promise.resolve({ id: where.id, ...data }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    notificationAuditRecord: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };
}

describe('DashboardService', () => {
  it('aggregates delivery metrics and provider health', async () => {
    const prisma = buildPrismaMock();
    const providers = {
      listAll: jest.fn().mockReturnValue([
        {
          health: jest.fn().mockResolvedValue({
            healthy: true,
            providerCode: 'sim-email',
            checkedAt: new Date(),
          }),
        },
      ]),
    };
    const service = new DashboardService(prisma as never, providers as never);

    const metrics = await service.metrics();
    expect(metrics.averageLatencyMs).toBe(42);
    expect(metrics.providerHealth).toHaveLength(1);
    expect(metrics.queueLength).toBe(4);
  });

  it('lists channel providers ordered by priority', async () => {
    const prisma = buildPrismaMock();
    const providers = { listAll: jest.fn().mockReturnValue([]) };
    const service = new DashboardService(prisma as never, providers as never);

    await service.listProviders();
    expect(prisma.notificationChannelProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { priority: 'asc' } }),
    );
  });

  it('enables/disables a provider row by id', async () => {
    const prisma = buildPrismaMock();
    const providers = { listAll: jest.fn().mockReturnValue([]) };
    const service = new DashboardService(prisma as never, providers as never);

    const updated = await service.setProviderEnabled('p1', false);
    expect(prisma.notificationChannelProvider.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isEnabled: false },
    });
    expect(updated).toMatchObject({ isEnabled: false });
  });

  it('throws NotFoundError when toggling a provider that does not exist', async () => {
    const prisma = buildPrismaMock();
    prisma.notificationChannelProvider.findUnique.mockResolvedValueOnce(null);
    const providers = { listAll: jest.fn().mockReturnValue([]) };
    const service = new DashboardService(prisma as never, providers as never);

    await expect(service.setProviderEnabled('missing', true)).rejects.toThrow(NotFoundError);
  });

  it('refreshes provider health and persists healthStatus per channel', async () => {
    const prisma = buildPrismaMock();
    const providers = {
      listAll: jest.fn().mockReturnValue([
        {
          getChannel: () => 'EMAIL',
          health: jest
            .fn()
            .mockResolvedValue({ healthy: true, providerCode: 'sim-email', checkedAt: new Date() }),
        },
      ]),
    };
    const service = new DashboardService(prisma as never, providers as never);

    const results = await service.refreshHealth();
    expect(results).toHaveLength(1);
    expect(prisma.notificationChannelProvider.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { channel: 'EMAIL' },
        data: expect.objectContaining({ healthStatus: 'HEALTHY' }),
      }),
    );
  });
});
