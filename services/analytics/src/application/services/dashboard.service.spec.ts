import { ForbiddenError, NotFoundError } from '../../domain';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const metrics = {
    recordDuration: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => jest.clearAllMocks());

  it('loads dashboard by code with widgets', async () => {
    const prisma = {
      analyticsDashboard: {
        findUnique: jest.fn().mockResolvedValue({ code: 'executive', widgets: [] }),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      analyticsEvent: { count: jest.fn() },
      metricDefinition: { count: jest.fn() },
      kpiDefinition: { count: jest.fn() },
      analyticsReport: { count: jest.fn() },
      aggregationJob: { count: jest.fn() },
      dashboardWidget: { create: jest.fn() },
    };
    const service = new DashboardService(prisma as never, metrics as never);
    const dashboard = await service.getByCode('executive');
    expect(dashboard.code).toBe('executive');
    expect(metrics.recordDuration).toHaveBeenCalledWith('dashboard_load_ms', expect.any(Number));
  });

  it('throws when dashboard missing', async () => {
    const prisma = {
      analyticsDashboard: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new DashboardService(prisma as never, metrics as never);
    await expect(service.getByCode('missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('allows system dashboard read for any user', () => {
    const service = new DashboardService({} as never, metrics as never);
    expect(() =>
      service.assertReadable({ ownerUserId: null, visibility: 'SYSTEM' }, 'user-1', false),
    ).not.toThrow();
  });

  it('denies private dashboard for other users', () => {
    const service = new DashboardService({} as never, metrics as never);
    expect(() =>
      service.assertReadable({ ownerUserId: 'owner-1', visibility: 'PRIVATE' }, 'user-2', false),
    ).toThrow(ForbiddenError);
  });

  it('allows shared dashboard read for owner only', () => {
    const service = new DashboardService({} as never, metrics as never);
    expect(() =>
      service.assertReadable({ ownerUserId: 'owner-1', visibility: 'SHARED' }, 'owner-1', false),
    ).not.toThrow();
  });

  it('denies shared dashboard read for non-owner non-admin', () => {
    const service = new DashboardService({} as never, metrics as never);
    expect(() =>
      service.assertReadable({ ownerUserId: 'owner-1', visibility: 'SHARED' }, 'user-2', false),
    ).toThrow(ForbiddenError);
  });

  it('allows shared dashboard read for admin', () => {
    const service = new DashboardService({} as never, metrics as never);
    expect(() =>
      service.assertReadable({ ownerUserId: 'owner-1', visibility: 'SHARED' }, 'user-2', true),
    ).not.toThrow();
  });

  it('returns admin metrics summary', async () => {
    const prisma = {
      analyticsEvent: { count: jest.fn().mockResolvedValue(10) },
      metricDefinition: { count: jest.fn().mockResolvedValue(7) },
      kpiDefinition: { count: jest.fn().mockResolvedValue(4) },
      analyticsDashboard: { count: jest.fn().mockResolvedValue(3) },
      analyticsReport: { count: jest.fn().mockResolvedValue(2) },
      aggregationJob: { count: jest.fn().mockResolvedValue(1) },
    };
    const service = new DashboardService(prisma as never, metrics as never);
    const summary = await service.adminMetrics();
    expect(summary.events).toBe(10);
    expect(summary.pendingAggregationJobs).toBe(1);
  });
});
