import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('creates audit records', async () => {
    const prisma = {
      analyticsAuditRecord: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1', action: 'test.action' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = new AuditService(prisma as never);
    const record = await service.record('test.action', { actorUserId: 'user-1' });
    expect(record.action).toBe('test.action');
    expect(prisma.analyticsAuditRecord.create).toHaveBeenCalled();
  });

  it('lists audit records with pagination', async () => {
    const prisma = {
      analyticsAuditRecord: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ id: 'a1' }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = new AuditService(prisma as never);
    const result = await service.list(0, 10);
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
