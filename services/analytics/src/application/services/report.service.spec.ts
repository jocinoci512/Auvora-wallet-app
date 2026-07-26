import { ForbiddenError, NotFoundError } from '../../domain';
import { ReportService } from './report.service';

describe('ReportService', () => {
  const metrics = {
    getValues: jest.fn().mockResolvedValue([
      { window: 'DAILY', bucketStart: new Date('2026-07-01'), value: 10, sampleCount: 1 },
    ]),
    recordDuration: jest.fn().mockResolvedValue(undefined),
  };
  const encryption = {
    encrypt: jest.fn((value: string) => `enc:${value}`),
    decrypt: jest.fn((value: string) => value.replace(/^enc:/, '')),
    hash: jest.fn(() => 'checksum-1'),
  };
  const clock = { now: jest.fn().mockReturnValue(new Date('2026-07-26T12:00:00.000Z')) };
  const events = { publish: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue({}) };

  beforeEach(() => jest.clearAllMocks());

  it('generates encrypted JSON report from template', async () => {
    const prisma = {
      reportTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tpl-1',
          code: 'wallet_activity',
          isEnabled: true,
          querySpec: { metrics: ['tx_volume'], window: 'DAILY' },
        }),
      },
      analyticsReport: {
        create: jest.fn().mockResolvedValue({ id: 'rep-1', status: 'READY' }),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };
    const service = new ReportService(
      prisma as never,
      metrics as never,
      encryption as never,
      clock as never,
      events as never,
      audit as never,
    );
    const result = await service.generate({
      templateCode: 'wallet_activity',
      name: 'Weekly Wallet Report',
      ownerUserId: 'user-1',
    });
    expect(result.report.status).toBe('READY');
    expect(encryption.encrypt).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith('report.generated', expect.any(Object));
  });

  it('denies report access to non-owner', async () => {
    const prisma = {
      analyticsReport: {
        findUnique: jest.fn().mockResolvedValue({ id: 'rep-1', ownerUserId: 'owner-1' }),
      },
    };
    const service = new ReportService(
      prisma as never,
      metrics as never,
      encryption as never,
      clock as never,
      events as never,
      audit as never,
    );
    await expect(service.get('rep-1', 'other-user', false)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('decrypts report result for owner', async () => {
    const prisma = {
      analyticsReport: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rep-1',
          ownerUserId: 'user-1',
          resultEncrypted: 'enc:[{"metricCode":"dau"}]',
        }),
      },
    };
    const service = new ReportService(
      prisma as never,
      metrics as never,
      encryption as never,
      clock as never,
      events as never,
      audit as never,
    );
    const result = await service.getDecryptedResult('rep-1', 'user-1', false);
    expect(result).toEqual([{ metricCode: 'dau' }]);
  });

  it('throws when template missing', async () => {
    const prisma = {
      reportTemplate: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new ReportService(
      prisma as never,
      metrics as never,
      encryption as never,
      clock as never,
      events as never,
      audit as never,
    );
    await expect(
      service.generate({ templateCode: 'missing', name: 'X', ownerUserId: 'u1' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
