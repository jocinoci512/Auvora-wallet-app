import { bucketStart, defaultWindowsForMetric, isAggregationWindow, parseMetricSnapshot } from './aggregation-policy';

describe('aggregation-policy', () => {
  it('computes hourly bucket start', () => {
    const date = new Date('2026-07-26T14:37:22.123Z');
    expect(bucketStart(date, 'HOURLY').toISOString()).toBe('2026-07-26T14:00:00.000Z');
  });

  it('computes daily bucket start', () => {
    const date = new Date('2026-07-26T14:37:22.123Z');
    expect(bucketStart(date, 'DAILY').toISOString()).toBe('2026-07-26T00:00:00.000Z');
  });

  it('computes monthly bucket start', () => {
    const date = new Date('2026-07-26T14:37:22.123Z');
    expect(bucketStart(date, 'MONTHLY').toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('computes weekly bucket start on Monday', () => {
    const date = new Date('2026-07-26T14:37:22.123Z');
    expect(bucketStart(date, 'WEEKLY').toISOString()).toBe('2026-07-20T00:00:00.000Z');
  });

  it('returns realtime bucket unchanged except milliseconds', () => {
    const date = new Date('2026-07-26T14:37:22.123Z');
    expect(bucketStart(date, 'REALTIME').toISOString()).toBe('2026-07-26T14:37:22.000Z');
  });

  it('defaults windows include hourly daily monthly', () => {
    expect(defaultWindowsForMetric()).toEqual(['HOURLY', 'DAILY', 'MONTHLY']);
  });

  it('validates aggregation windows', () => {
    expect(isAggregationWindow('DAILY')).toBe(true);
    expect(isAggregationWindow('INVALID')).toBe(false);
  });

  it('parses numeric metric snapshots', () => {
    expect(parseMetricSnapshot({ dau: 10, tx_volume: 2.5, ignored: 'x' })).toEqual({
      dau: 10,
      tx_volume: 2.5,
    });
  });

  it('returns empty snapshot for invalid input', () => {
    expect(parseMetricSnapshot(null)).toEqual({});
    expect(parseMetricSnapshot([])).toEqual({});
  });

  it('ignores non-finite numbers', () => {
    expect(parseMetricSnapshot({ bad: Number.NaN, ok: 1 })).toEqual({ ok: 1 });
  });
});
