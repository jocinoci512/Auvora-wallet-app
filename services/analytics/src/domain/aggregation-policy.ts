import type { AggregationWindow } from '@auvora/database';
import { ValidationError } from './errors';

const AGGREGATION_WINDOWS: AggregationWindow[] = ['REALTIME', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY'];

export function isAggregationWindow(value: string): value is AggregationWindow {
  return AGGREGATION_WINDOWS.includes(value as AggregationWindow);
}

/** Returns the UTC bucket start for the given instant and aggregation window. */
export function bucketStart(date: Date, window: AggregationWindow): Date {
  const d = new Date(date);
  d.setUTCMilliseconds(0);

  switch (window) {
    case 'REALTIME':
      return d;
    case 'HOURLY':
      d.setUTCSeconds(0);
      d.setUTCMinutes(0);
      return d;
    case 'DAILY':
      d.setUTCSeconds(0);
      d.setUTCMinutes(0);
      d.setUTCHours(0);
      return d;
    case 'WEEKLY': {
      d.setUTCSeconds(0);
      d.setUTCMinutes(0);
      d.setUTCHours(0);
      const day = d.getUTCDay();
      const diff = day === 0 ? 6 : day - 1;
      d.setUTCDate(d.getUTCDate() - diff);
      return d;
    }
    case 'MONTHLY':
      d.setUTCSeconds(0);
      d.setUTCMinutes(0);
      d.setUTCHours(0);
      d.setUTCDate(1);
      return d;
    default:
      throw new ValidationError(`Unsupported aggregation window: ${String(window)}`);
  }
}

export function defaultWindowsForMetric(): AggregationWindow[] {
  return ['HOURLY', 'DAILY', 'MONTHLY'];
}

export function parseMetricSnapshot(metrics: unknown): Record<string, number> {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(metrics as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      result[key] = value;
    }
  }
  return result;
}
