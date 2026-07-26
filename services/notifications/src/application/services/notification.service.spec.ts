import type { JwtAccessClaims } from '@auvora/types';
import { ForbiddenError, ValidationError } from '../../domain';
import { NotificationService } from './notification.service';

function buildPrismaMock(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    notificationMessage: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'notif-1', createdAt: new Date(), ...data }),
      ),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, ownerUserId: 'user-1', status: 'QUEUED', metadata: {}, ...data }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    notificationDeliveryLog: { findMany: jest.fn().mockResolvedValue([]) },
    ...overrides,
  };
}

const templatesMock = {
  get: jest.fn(),
  getByCode: jest.fn(),
};

const preferencesMock = {
  evaluateSuppression: jest.fn().mockResolvedValue({ suppressed: false }),
};

const queueMock = {
  enqueue: jest.fn().mockResolvedValue({}),
};

const eventsMock = { publish: jest.fn().mockResolvedValue(undefined) };

const owner: JwtAccessClaims = {
  sub: 'user-1',
  email: 'user@auvora.io',
  sessionId: 's1',
  roles: ['user'],
  permissions: [] as never,
};

const stranger: JwtAccessClaims = {
  sub: 'user-2',
  email: 'stranger@auvora.io',
  sessionId: 's2',
  roles: ['user'],
  permissions: [] as never,
};

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    preferencesMock.evaluateSuppression.mockResolvedValue({ suppressed: false });
  });

  it('creates and enqueues an immediate notification', async () => {
    const prisma = buildPrismaMock();
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    const result = await service.send({
      ownerUserId: 'user-1',
      category: 'SECURITY' as never,
      channel: 'EMAIL' as never,
      recipient: 'user@auvora.io',
      body: 'Your code is 123456',
    });

    expect(result).toMatchObject({ status: 'QUEUED', body: 'Your code is 123456' });
    expect(queueMock.enqueue).toHaveBeenCalledWith('notif-1', expect.objectContaining({ priority: 'NORMAL' }));
    expect(eventsMock.publish).toHaveBeenCalled();
  });

  it('always assigns a correlationId, generating one when the caller does not supply it', async () => {
    const prisma = buildPrismaMock();
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    const result = await service.send({
      ownerUserId: 'user-1',
      category: 'SECURITY' as never,
      channel: 'EMAIL' as never,
      recipient: 'user@auvora.io',
      body: 'hi',
    });

    expect(result.correlationId).toBeDefined();
    expect(typeof result.correlationId).toBe('string');
    expect(eventsMock.publish).toHaveBeenCalledWith(expect.objectContaining({ correlationId: result.correlationId }));
  });

  it('preserves a caller-supplied correlationId and links source event metadata', async () => {
    const prisma = buildPrismaMock();
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    const result = await service.send({
      ownerUserId: 'user-1',
      category: 'PAYMENT' as never,
      channel: 'EMAIL' as never,
      recipient: 'user@auvora.io',
      body: 'Your payment completed',
      correlationId: 'corr-123',
      sourceEventType: 'payment.completed',
      sourceEventId: 'payment-1',
    });

    expect(result.correlationId).toBe('corr-123');
    expect(prisma.notificationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correlationId: 'corr-123',
          sourceEventType: 'payment.completed',
          sourceEventId: 'payment-1',
        }),
      }),
    );
  });

  it('returns the existing notification when dedupeKey already exists', async () => {
    const existing = { id: 'existing-1', dedupeKey: 'dedupe-a' };
    const prisma = buildPrismaMock();
    prisma.notificationMessage.findUnique.mockResolvedValueOnce(existing);
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    const result = await service.send({
      ownerUserId: 'user-1',
      category: 'SECURITY' as never,
      channel: 'EMAIL' as never,
      recipient: 'user@auvora.io',
      body: 'hi',
      dedupeKey: 'dedupe-a',
    });

    expect(result).toBe(existing);
    expect(prisma.notificationMessage.create).not.toHaveBeenCalled();
    expect(queueMock.enqueue).not.toHaveBeenCalled();
  });

  it('renders a template into subject and body before persisting', async () => {
    templatesMock.get.mockResolvedValueOnce({
      id: 'tpl-1',
      subject: 'Hi {{name}}',
      body: 'Welcome {{name}}!',
      format: 'TEXT',
    });
    const prisma = buildPrismaMock();
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    await service.send({
      ownerUserId: 'user-1',
      templateId: 'tpl-1',
      category: 'SECURITY' as never,
      channel: 'EMAIL' as never,
      recipient: 'user@auvora.io',
      variables: { name: 'Ada' },
    });

    expect(prisma.notificationMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subject: 'Hi Ada', body: 'Welcome Ada!' }) }),
    );
  });

  it('suppresses a notification and skips enqueue when preferences block it', async () => {
    preferencesMock.evaluateSuppression.mockResolvedValueOnce({ suppressed: true, reason: 'QUIET_HOURS' });
    const prisma = buildPrismaMock();
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    const result = await service.send({
      ownerUserId: 'user-1',
      category: 'MARKETING' as never,
      channel: 'PUSH' as never,
      recipient: 'device-token',
      body: 'Sale!',
    });

    expect(result).toMatchObject({ status: 'SUPPRESSED' });
    expect(queueMock.enqueue).not.toHaveBeenCalled();
  });

  it('throws a ValidationError when neither body nor template is provided', async () => {
    const prisma = buildPrismaMock();
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    await expect(
      service.send({
        ownerUserId: 'user-1',
        category: 'SECURITY' as never,
        channel: 'EMAIL' as never,
        recipient: 'user@auvora.io',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('allows the owner to mark their own notification as read but forbids strangers', async () => {
    const prisma = buildPrismaMock();
    prisma.notificationMessage.findUnique.mockResolvedValue({ id: 'notif-1', ownerUserId: 'user-1', status: 'SENT', metadata: {} });
    const service = new NotificationService(prisma as never, eventsMock as never, templatesMock as never, preferencesMock as never, queueMock as never);

    await expect(service.markRead('notif-1', stranger)).rejects.toThrow(ForbiddenError);
    await expect(service.markRead('notif-1', owner)).resolves.toMatchObject({ status: 'DELIVERED' });
  });
});
