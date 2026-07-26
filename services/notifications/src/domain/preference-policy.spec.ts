import {
  evaluateFrequencyLimit,
  evaluatePreferenceSuppression,
  isCategoryEnabled,
  isChannelEnabled,
  isWithinQuietHours,
} from './preference-policy';

describe('preference-policy', () => {
  it('detects a same-day quiet hours window', () => {
    expect(isWithinQuietHours(10, 9, 17)).toBe(true);
    expect(isWithinQuietHours(8, 9, 17)).toBe(false);
    expect(isWithinQuietHours(17, 9, 17)).toBe(false);
  });

  it('detects a quiet hours window that wraps past midnight', () => {
    expect(isWithinQuietHours(23, 22, 6)).toBe(true);
    expect(isWithinQuietHours(3, 22, 6)).toBe(true);
    expect(isWithinQuietHours(12, 22, 6)).toBe(false);
  });

  it('treats unset quiet hours as always allowed', () => {
    expect(isWithinQuietHours(3, null, null)).toBe(false);
    expect(isWithinQuietHours(3, undefined, 6)).toBe(false);
  });

  it('defaults channel and category toggles to enabled when unset', () => {
    expect(isChannelEnabled(undefined, 'EMAIL')).toBe(true);
    expect(isChannelEnabled({ EMAIL: false }, 'EMAIL')).toBe(false);
    expect(isCategoryEnabled({ MARKETING: false }, 'SECURITY')).toBe(true);
  });

  it('suppresses when the channel is explicitly disabled', () => {
    const decision = evaluatePreferenceSuppression({
      channel: 'EMAIL',
      category: 'MARKETING',
      priority: 'NORMAL',
      hourOfDay: 10,
      channelToggles: { EMAIL: false },
    });
    expect(decision).toEqual({ suppressed: true, reason: 'CHANNEL_DISABLED' });
  });

  it('suppresses during quiet hours for normal priority notifications', () => {
    const decision = evaluatePreferenceSuppression({
      channel: 'PUSH',
      category: 'MARKETING',
      priority: 'NORMAL',
      hourOfDay: 23,
      quietHoursStart: 22,
      quietHoursEnd: 6,
    });
    expect(decision).toEqual({ suppressed: true, reason: 'QUIET_HOURS' });
  });

  it('bypasses quiet-hours suppression for CRITICAL priority notifications', () => {
    const decision = evaluatePreferenceSuppression({
      channel: 'PUSH',
      category: 'SECURITY',
      priority: 'CRITICAL',
      hourOfDay: 23,
      quietHoursStart: 22,
      quietHoursEnd: 6,
    });
    expect(decision).toEqual({ suppressed: false });
  });

  it('allows delivery when no restrictions apply', () => {
    const decision = evaluatePreferenceSuppression({
      channel: 'EMAIL',
      category: 'SECURITY',
      priority: 'NORMAL',
      hourOfDay: 10,
    });
    expect(decision).toEqual({ suppressed: false });
  });

  describe('evaluateFrequencyLimit', () => {
    it('is false when no limit is configured', () => {
      expect(evaluateFrequencyLimit(undefined, 100, 100)).toBe(false);
    });

    it('trips once the hourly cap is reached', () => {
      expect(evaluateFrequencyLimit({ maxPerHour: 5 }, 4, 0)).toBe(false);
      expect(evaluateFrequencyLimit({ maxPerHour: 5 }, 5, 0)).toBe(true);
    });

    it('trips once the daily cap is reached', () => {
      expect(evaluateFrequencyLimit({ maxPerDay: 20 }, 0, 19)).toBe(false);
      expect(evaluateFrequencyLimit({ maxPerDay: 20 }, 0, 20)).toBe(true);
    });
  });

  it('suppresses with FREQUENCY_LIMIT when the channel-keyed limit is exceeded', () => {
    const decision = evaluatePreferenceSuppression({
      channel: 'EMAIL',
      category: 'MARKETING',
      priority: 'NORMAL',
      hourOfDay: 10,
      frequencyLimits: { EMAIL: { maxPerHour: 3 } },
      recentHourCount: 3,
    });
    expect(decision).toEqual({ suppressed: true, reason: 'FREQUENCY_LIMIT' });
  });

  it('falls back to a category-keyed limit when no channel-keyed limit exists', () => {
    const decision = evaluatePreferenceSuppression({
      channel: 'EMAIL',
      category: 'MARKETING',
      priority: 'NORMAL',
      hourOfDay: 10,
      frequencyLimits: { MARKETING: { maxPerDay: 10 } },
      recentDayCount: 10,
    });
    expect(decision).toEqual({ suppressed: true, reason: 'FREQUENCY_LIMIT' });
  });

  it('bypasses frequency limits for CRITICAL priority notifications', () => {
    const decision = evaluatePreferenceSuppression({
      channel: 'EMAIL',
      category: 'SECURITY',
      priority: 'CRITICAL',
      hourOfDay: 10,
      frequencyLimits: { EMAIL: { maxPerHour: 1 } },
      recentHourCount: 50,
    });
    expect(decision).toEqual({ suppressed: false });
  });
});
