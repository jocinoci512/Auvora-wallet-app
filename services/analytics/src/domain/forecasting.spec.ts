import { linearTrend, metricValuesToTrendPoints } from './forecasting';

describe('forecasting', () => {
  it('projects a linear upward trend', () => {
    const result = linearTrend(
      [
        { x: 0, y: 1 },
        { x: 1, y: 2 },
        { x: 2, y: 3 },
      ],
      2,
    );
    expect(result.slope).toBeCloseTo(1);
    expect(result.points).toHaveLength(2);
    expect(result.points[0]?.y).toBeCloseTo(4);
    expect(result.points[1]?.y).toBeCloseTo(5);
  });

  it('returns empty forecast for empty input', () => {
    const result = linearTrend([], 3);
    expect(result.points).toEqual([]);
    expect(result.slope).toBe(0);
  });

  it('handles flat series', () => {
    const result = linearTrend(
      [
        { x: 0, y: 5 },
        { x: 1, y: 5 },
      ],
      1,
    );
    expect(result.points[0]?.y).toBeCloseTo(5);
  });

  it('converts metric values to trend points', () => {
    const points = metricValuesToTrendPoints([
      { bucketStart: new Date('2026-07-01'), value: 10 },
      { bucketStart: new Date('2026-07-02'), value: 20 },
    ]);
    expect(points).toEqual([
      { x: 0, y: 10 },
      { x: 1, y: 20 },
    ]);
  });

  it('rejects non-positive horizon', () => {
    expect(() => linearTrend([{ x: 0, y: 1 }], 0)).toThrow('Forecast horizon');
  });
});
