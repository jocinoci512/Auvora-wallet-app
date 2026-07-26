import { ValidationError } from '../../domain';
import { BroadcastService } from './broadcast.service';

function buildPrismaMock(users: { id: string }[] = []) {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
    },
  };
}

describe('BroadcastService', () => {
  it('broadcasts to explicit userIds without querying the database', async () => {
    const prisma = buildPrismaMock();
    const notifications = { sendBatch: jest.fn().mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]) };
    const service = new BroadcastService(prisma as never, notifications as never);

    const result = await service.broadcast('admin-1', {
      category: 'ADMIN' as never,
      channel: 'IN_APP' as never,
      body: 'Maintenance tonight',
      userIds: ['user-1', 'user-2'],
    });

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(result.recipientCount).toBe(2);
    expect(notifications.sendBatch).toHaveBeenCalledWith([
      expect.objectContaining({ ownerUserId: 'user-1' }),
      expect.objectContaining({ ownerUserId: 'user-2' }),
    ]);
  });

  it('resolves recipients by role membership', async () => {
    const prisma = buildPrismaMock([{ id: 'user-a' }, { id: 'user-b' }]);
    const notifications = { sendBatch: jest.fn().mockResolvedValue([]) };
    const service = new BroadcastService(prisma as never, notifications as never);

    await service.broadcast('admin-1', {
      category: 'ADMIN' as never,
      channel: 'EMAIL' as never,
      body: 'Role broadcast',
      roles: ['compliance_officer'],
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ roles: { some: { role: { name: { in: ['compliance_officer'] } } } } }) }),
    );
  });

  it('throws a ValidationError when no recipients can be resolved', async () => {
    const prisma = buildPrismaMock();
    const notifications = { sendBatch: jest.fn() };
    const service = new BroadcastService(prisma as never, notifications as never);

    await expect(
      service.broadcast('admin-1', { category: 'ADMIN' as never, channel: 'EMAIL' as never, body: 'x' }),
    ).rejects.toThrow(ValidationError);
  });
});
