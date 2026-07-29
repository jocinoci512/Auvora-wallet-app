import { PreferenceService } from './preference.service';

function buildPrismaMock(
  preferenceRow: Record<string, unknown> | null,
  recentCounts: { hour?: number; day?: number } = {},
) {
  const countMock = jest
    .fn()
    .mockImplementation(({ where }: { where: { createdAt: { gte: Date } } }) => {
      // The hourly and daily windows are distinguished by how far back `gte` is; anything within
      // the last ~90 minutes is treated as the "hour" bucket for test purposes.
      const isHourWindow = Date.now() - where.createdAt.gte.getTime() < 90 * 60 * 1000;
      return Promise.resolve(isHourWindow ? (recentCounts.hour ?? 0) : (recentCounts.day ?? 0));
    });
  return {
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue(preferenceRow),
      upsert: jest
        .fn()
        .mockImplementation(({ create }: { create: Record<string, unknown> }) =>
          Promise.resolve({ id: 'pref-1', ...create }),
        ),
    },
    notificationMessage: {
      count: countMock,
    },
  };
}

const eventsMock = { publish: jest.fn().mockResolvedValue(undefined) };

describe('PreferenceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns sensible defaults when no preference row exists', async () => {
    const prisma = buildPrismaMock(null);
    const service = new PreferenceService(prisma as never, eventsMock as never);

    const preference = await service.get('user-1');
    expect(preference).toMatchObject({
      ownerUserId: 'user-1',
      timeZone: 'UTC',
      quietHoursStart: null,
    });
  });

  it('upserts a preference and publishes a PreferenceUpdated event', async () => {
    const prisma = buildPrismaMock(null);
    const service = new PreferenceService(prisma as never, eventsMock as never);

    await service.upsert('user-1', { timeZone: 'UTC', channelToggles: { EMAIL: false } });

    expect(prisma.notificationPreference.upsert).toHaveBeenCalled();
    expect(eventsMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateId: 'user-1' }),
    );
  });

  it('suppresses when the stored preference disables the channel', async () => {
    const prisma = buildPrismaMock({
      ownerUserId: 'user-1',
      timeZone: 'UTC',
      channelToggles: { EMAIL: false },
      categoryToggles: {},
      quietHoursStart: null,
      quietHoursEnd: null,
    });
    const service = new PreferenceService(prisma as never, eventsMock as never);

    const decision = await service.evaluateSuppression(
      'user-1',
      'EMAIL' as never,
      'MARKETING' as never,
      'NORMAL',
    );
    expect(decision).toEqual({ suppressed: true, reason: 'CHANNEL_DISABLED' });
  });

  it('suppresses during quiet hours computed in UTC', async () => {
    const prisma = buildPrismaMock({
      ownerUserId: 'user-1',
      timeZone: 'UTC',
      channelToggles: {},
      categoryToggles: {},
      quietHoursStart: 0,
      quietHoursEnd: 23,
    });
    const service = new PreferenceService(prisma as never, eventsMock as never);

    const at = new Date(Date.UTC(2026, 0, 1, 10, 0, 0));
    const decision = await service.evaluateSuppression(
      'user-1',
      'PUSH' as never,
      'MARKETING' as never,
      'NORMAL',
      at,
    );
    expect(decision).toEqual({ suppressed: true, reason: 'QUIET_HOURS' });
  });

  it('suppresses once the hourly frequency limit for the channel is reached', async () => {
    const prisma = buildPrismaMock(
      {
        ownerUserId: 'user-1',
        timeZone: 'UTC',
        channelToggles: {},
        categoryToggles: {},
        quietHoursStart: null,
        quietHoursEnd: null,
        frequencyLimits: { EMAIL: { maxPerHour: 3 } },
      },
      { hour: 3 },
    );
    const service = new PreferenceService(prisma as never, eventsMock as never);

    const decision = await service.evaluateSuppression(
      'user-1',
      'EMAIL' as never,
      'MARKETING' as never,
      'NORMAL',
    );
    expect(decision).toEqual({ suppressed: true, reason: 'FREQUENCY_LIMIT' });
    expect(prisma.notificationMessage.count).toHaveBeenCalled();
  });

  it('allows delivery when the frequency limit has not yet been reached', async () => {
    const prisma = buildPrismaMock(
      {
        ownerUserId: 'user-1',
        timeZone: 'UTC',
        channelToggles: {},
        categoryToggles: {},
        quietHoursStart: null,
        quietHoursEnd: null,
        frequencyLimits: { EMAIL: { maxPerHour: 3 } },
      },
      { hour: 1 },
    );
    const service = new PreferenceService(prisma as never, eventsMock as never);

    const decision = await service.evaluateSuppression(
      'user-1',
      'EMAIL' as never,
      'MARKETING' as never,
      'NORMAL',
    );
    expect(decision).toEqual({ suppressed: false });
  });

  it('does not query recent counts when no frequency limit applies to the channel or category', async () => {
    const prisma = buildPrismaMock({
      ownerUserId: 'user-1',
      timeZone: 'UTC',
      channelToggles: {},
      categoryToggles: {},
      quietHoursStart: null,
      quietHoursEnd: null,
      frequencyLimits: { SMS: { maxPerHour: 1 } },
    });
    const service = new PreferenceService(prisma as never, eventsMock as never);

    const decision = await service.evaluateSuppression(
      'user-1',
      'EMAIL' as never,
      'MARKETING' as never,
      'NORMAL',
    );
    expect(decision).toEqual({ suppressed: false });
    expect(prisma.notificationMessage.count).not.toHaveBeenCalled();
  });

  it('bypasses frequency-limit suppression for CRITICAL priority notifications', async () => {
    const prisma = buildPrismaMock(
      {
        ownerUserId: 'user-1',
        timeZone: 'UTC',
        channelToggles: {},
        categoryToggles: {},
        quietHoursStart: null,
        quietHoursEnd: null,
        frequencyLimits: { EMAIL: { maxPerHour: 1 } },
      },
      { hour: 5 },
    );
    const service = new PreferenceService(prisma as never, eventsMock as never);

    const decision = await service.evaluateSuppression(
      'user-1',
      'EMAIL' as never,
      'SECURITY' as never,
      'CRITICAL',
    );
    expect(decision).toEqual({ suppressed: false });
  });
});
