import { computeNextRunAt, normalizeCronExpression, ScheduledCronAlias } from './scheduled-cron';

describe('scheduled-cron', () => {
  it('normalizes @hourly alias', () => {
    expect(normalizeCronExpression('@hourly')).toBe('0 * * * *');
  });

  it('normalizes @daily alias', () => {
    expect(normalizeCronExpression('@daily')).toBe('0 0 * * *');
  });

  it('computes next hourly run', () => {
    const from = new Date('2026-07-26T14:15:00.000Z');
    const next = computeNextRunAt(ScheduledCronAlias.Hourly, from);
    expect(next.toISOString()).toBe('2026-07-26T15:00:00.000Z');
  });

  it('computes next daily run', () => {
    const from = new Date('2026-07-26T14:15:00.000Z');
    const next = computeNextRunAt(ScheduledCronAlias.Daily, from);
    expect(next.toISOString()).toBe('2026-07-27T00:00:00.000Z');
  });

  it('falls back for unknown cron expressions', () => {
    const from = new Date('2026-07-26T14:15:00.000Z');
    const next = computeNextRunAt('bad cron', from);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });
});
