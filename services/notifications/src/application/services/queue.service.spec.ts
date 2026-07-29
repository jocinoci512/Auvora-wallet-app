import { ConflictError } from '../../domain';
import { QueueService } from './queue.service';

function buildNotification(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'notif-1',
    channel: 'EMAIL',
    body: 'hello',
    subject: 'hi',
    ownerUserId: 'user-1',
    metadata: { recipient: 'user@auvora.io' },
    maxAttempts: 5,
    ...overrides,
  };
}

function buildQueueItem(
  notification: ReturnType<typeof buildNotification>,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id: 'queue-1',
    notificationId: notification.id,
    status: 'QUEUED',
    priority: 'NORMAL',
    availableAt: new Date(Date.now() - 1000),
    attemptCount: 0,
    createdAt: new Date(),
    notification,
    ...overrides,
  };
}

function buildPrismaMock(queueItem: ReturnType<typeof buildQueueItem>) {
  return {
    notificationQueueItem: {
      create: jest.fn().mockResolvedValue(queueItem),
      findMany: jest.fn().mockResolvedValue([queueItem]),
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(queueItem)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...queueItem, ...data }),
        ),
      count: jest.fn().mockResolvedValue(0),
    },
    notificationMessage: {
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
    },
    notificationDeliveryLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };
}

const eventsMock = { publish: jest.fn().mockResolvedValue(undefined) };
const aiMock = { publishEvent: jest.fn().mockResolvedValue(undefined) };
const analyticsMock = { publishEvent: jest.fn().mockResolvedValue(undefined) };

describe('QueueService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enqueues a notification as a QUEUED queue item', async () => {
    const notification = buildNotification();
    const queueItem = buildQueueItem(notification);
    const prisma = buildPrismaMock(queueItem);
    const providers = { resolve: jest.fn(), listAll: jest.fn() };
    const service = new QueueService(
      prisma as never,
      providers as never,
      eventsMock as never,
      aiMock as never,
      analyticsMock as never,
    );

    await service.enqueue('notif-1', { priority: 'NORMAL' as never });
    expect(prisma.notificationQueueItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notificationId: 'notif-1', status: 'QUEUED' }),
      }),
    );
  });

  it('returns processed:false when there is nothing to claim', async () => {
    const notification = buildNotification();
    const queueItem = buildQueueItem(notification);
    const prisma = buildPrismaMock(queueItem);
    prisma.notificationQueueItem.findMany.mockResolvedValueOnce([]);
    const providers = { resolve: jest.fn(), listAll: jest.fn() };
    const service = new QueueService(
      prisma as never,
      providers as never,
      eventsMock as never,
      aiMock as never,
      analyticsMock as never,
    );

    const result = await service.processNext();
    expect(result).toEqual({ processed: false });
  });

  it('delivers a claimed item successfully via the resolved channel provider', async () => {
    const notification = buildNotification();
    const queueItem = buildQueueItem(notification);
    const prisma = buildPrismaMock(queueItem);
    const provider = {
      send: jest.fn().mockResolvedValue({ providerCode: 'sim-email', success: true, latencyMs: 5 }),
    };
    const providers = { resolve: jest.fn().mockReturnValue(provider), listAll: jest.fn() };
    const service = new QueueService(
      prisma as never,
      providers as never,
      eventsMock as never,
      aiMock as never,
      analyticsMock as never,
    );

    const result = await service.processNext('worker-1');

    expect(providers.resolve).toHaveBeenCalledWith('EMAIL');
    expect(result).toMatchObject({ processed: true, success: true });
    expect(prisma.notificationMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
    expect(eventsMock.publish).toHaveBeenCalled();
  });

  it('retries with backoff when delivery fails and attempts remain', async () => {
    const notification = buildNotification({ maxAttempts: 5 });
    const queueItem = buildQueueItem(notification, { attemptCount: 1 });
    const prisma = buildPrismaMock(queueItem);
    const provider = { send: jest.fn().mockRejectedValue(new Error('smtp down')) };
    const providers = { resolve: jest.fn().mockReturnValue(provider), listAll: jest.fn() };
    const service = new QueueService(
      prisma as never,
      providers as never,
      eventsMock as never,
      aiMock as never,
      analyticsMock as never,
    );

    const result = await service.processNext();

    expect(result).toMatchObject({ processed: true, success: false });
    expect(prisma.notificationQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'QUEUED' }) }),
    );
  });

  it('dead-letters when attempts are exhausted', async () => {
    const notification = buildNotification({ maxAttempts: 3 });
    const queueItem = buildQueueItem(notification, { attemptCount: 3 });
    const prisma = buildPrismaMock(queueItem);
    const provider = { send: jest.fn().mockRejectedValue(new Error('permanent failure')) };
    const providers = { resolve: jest.fn().mockReturnValue(provider), listAll: jest.fn() };
    const service = new QueueService(
      prisma as never,
      providers as never,
      eventsMock as never,
      aiMock as never,
      analyticsMock as never,
    );

    await service.processNext();

    expect(prisma.notificationQueueItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'DEAD_LETTER' }) }),
    );
  });

  it('refuses to requeue an item that is not FAILED or DEAD_LETTER', async () => {
    const notification = buildNotification();
    const queueItem = buildQueueItem(notification, { status: 'SENT' });
    const prisma = buildPrismaMock(queueItem);
    const providers = { resolve: jest.fn(), listAll: jest.fn() };
    const service = new QueueService(
      prisma as never,
      providers as never,
      eventsMock as never,
      aiMock as never,
      analyticsMock as never,
    );

    await expect(service.requeue('queue-1')).rejects.toThrow(ConflictError);
  });
});
