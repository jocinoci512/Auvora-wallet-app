export type AlertComparison = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export function evaluateThreshold(
  value: number,
  threshold: number,
  comparison: AlertComparison = 'gt',
): boolean {
  switch (comparison) {
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'eq':
      return value === threshold;
    default:
      return false;
  }
}
