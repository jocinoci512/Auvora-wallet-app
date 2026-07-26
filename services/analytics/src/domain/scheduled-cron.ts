export enum ScheduledCronAlias {
  Hourly = '@hourly',
  Daily = '@daily',
}

export function normalizeCronExpression(expression: string): string {
  const trimmed = expression.trim().toLowerCase();
  if (trimmed === ScheduledCronAlias.Hourly) {
    return '0 * * * *';
  }
  if (trimmed === ScheduledCronAlias.Daily) {
    return '0 0 * * *';
  }
  return expression.trim();
}

/** Minimal next-run estimator for @hourly and @daily aliases plus standard five-field cron. */
export function computeNextRunAt(expression: string, from: Date = new Date()): Date {
  const normalized = normalizeCronExpression(expression);
  const next = new Date(from);
  next.setUTCSeconds(0, 0);

  if (normalized === '0 * * * *') {
    next.setUTCMinutes(0);
    next.setUTCHours(next.getUTCHours() + 1);
    return next;
  }

  if (normalized === '0 0 * * *') {
    next.setUTCMinutes(0);
    next.setUTCHours(0);
    if (next <= from) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }

  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) {
    next.setUTCMinutes(next.getUTCMinutes() + 60);
    return next;
  }

  const [minutePart, hourPart] = parts;
  const minute = minutePart === '*' ? 0 : Number.parseInt(minutePart ?? '0', 10);
  const hour = hourPart === '*' ? next.getUTCHours() : Number.parseInt(hourPart ?? '0', 10);

  next.setUTCMinutes(Number.isFinite(minute) ? minute : 0);
  next.setUTCHours(Number.isFinite(hour) ? hour : next.getUTCHours());
  if (next <= from) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}
