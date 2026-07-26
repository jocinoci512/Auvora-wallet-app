import { ValidationError } from './errors';

export interface TrendPoint {
  x: number;
  y: number;
}

export interface LinearTrendResult {
  slope: number;
  intercept: number;
  points: TrendPoint[];
}

export function linearTrend(points: TrendPoint[], horizon: number): LinearTrendResult {
  if (horizon < 1) {
    throw new ValidationError('Forecast horizon must be at least 1');
  }
  if (points.length === 0) {
    return { slope: 0, intercept: 0, points: [] };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const lastX = points[points.length - 1]?.x ?? 0;
  const forecastPoints: TrendPoint[] = [];
  for (let i = 1; i <= horizon; i += 1) {
    const x = lastX + i;
    forecastPoints.push({ x, y: slope * x + intercept });
  }

  return { slope, intercept, points: forecastPoints };
}

export function metricValuesToTrendPoints(
  values: Array<{ bucketStart: Date; value: number }>,
): TrendPoint[] {
  return values.map((entry, index) => ({
    x: index,
    y: entry.value,
  }));
}
