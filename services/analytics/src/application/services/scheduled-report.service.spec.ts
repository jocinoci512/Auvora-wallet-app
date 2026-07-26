import { NotFoundError } from '../../domain';
import { ScheduledReportService } from './scheduled-report.service';

describe('ScheduledReportService', () => {
  const reports = {
    generate: jest.fn().mockResolvedValue({ report: { id: 'rep-1' }, rowCount: 1 }),
  };
  const clock = { now: jest.fn().mockReturnValue(new Date('2026-07-26T12:00:00.000Z')) };

  beforeEach(() => jest.clearAllMocks());

  it('creates scheduled report with normalized cron', async () => {
    const prisma = {
      reportTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tpl-1',
          code: 'wallet_activity',
          isEnabled: true,
          defaultFormat: 'JSON',
        }),
      },
      scheduledReport: {
        create: jest.fn().mockResolvedValue({ id: 'sch-1', cronExpression: '0 * * * *' }),
        findMany: jest.fn(),
      },
    };
    const service = new ScheduledReportService(prisma as never, reports as never, clock as never);
    const scheduled = await service.create({
      templateCode: 'wallet_activity',
      name: 'Hourly Wallet Report',
      cronExpression: '@hourly',
    });
    expect(scheduled.cronExpression).toBe('0 * * * *');
  });

  it('processes due scheduled reports', async () => {
    const prisma = {
      scheduledReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sch-1',
            name: 'Daily',
            cronExpression: '0 0 * * *',
            format: 'JSON',
            parameters: null,
            ownerUserId: 'user-1',
            attemptCount: 0,
            maxAttempts: 5,
            template: { code: 'wallet_activity' },
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ScheduledReportService(prisma as never, reports as never, clock as never);
    const processed = await service.processDueReports();
    expect(processed).toBe(1);
    expect(reports.generate).toHaveBeenCalled();
    expect(prisma.scheduledReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ attemptCount: 0, lastError: null, nextAttemptAt: null }),
      }),
    );
  });

  it('schedules retry on failure before max attempts', async () => {
    reports.generate.mockRejectedValueOnce(new Error('generate failed'));
    const prisma = {
      scheduledReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sch-1',
            name: 'Daily',
            cronExpression: '0 0 * * *',
            format: 'JSON',
            parameters: null,
            ownerUserId: 'user-1',
            attemptCount: 1,
            maxAttempts: 5,
            template: { code: 'wallet_activity' },
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ScheduledReportService(prisma as never, reports as never, clock as never);
    await service.processDueReports();
    expect(prisma.scheduledReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attemptCount: 2,
          lastError: 'generate failed',
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });

  it('marks failed after max attempts exhausted', async () => {
    reports.generate.mockRejectedValueOnce(new Error('generate failed'));
    const prisma = {
      scheduledReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sch-1',
            name: 'Daily',
            cronExpression: '0 0 * * *',
            format: 'JSON',
            parameters: null,
            ownerUserId: 'user-1',
            attemptCount: 4,
            maxAttempts: 5,
            template: { code: 'wallet_activity' },
          },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new ScheduledReportService(prisma as never, reports as never, clock as never);
    await service.processDueReports();
    expect(prisma.scheduledReport.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED', attemptCount: 5 }),
      }),
    );
  });

  it('throws when template missing on create', async () => {
    const prisma = { reportTemplate: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new ScheduledReportService(prisma as never, reports as never, clock as never);
    await expect(
      service.create({ templateCode: 'missing', name: 'X', cronExpression: '@daily' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('pauses scheduled report', async () => {
    const prisma = {
      scheduledReport: {
        update: jest.fn().mockResolvedValue({ id: 'sch-1', status: 'PAUSED' }),
      },
    };
    const service = new ScheduledReportService(prisma as never, reports as never, clock as never);
    const result = await service.pause('sch-1');
    expect(result.status).toBe('PAUSED');
  });
});
