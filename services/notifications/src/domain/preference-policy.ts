import type { NotificationPriorityCode } from './queue-policy';

export interface ChannelToggleMap {
  [channel: string]: boolean;
}

export interface CategoryToggleMap {
  [category: string]: boolean;
}

/** Handles both same-day windows (9-17) and windows that wrap past midnight (22-6). */
export function isWithinQuietHours(
  hourOfDay: number,
  quietHoursStart: number | null | undefined,
  quietHoursEnd: number | null | undefined,
): boolean {
  if (quietHoursStart === null || quietHoursStart === undefined) return false;
  if (quietHoursEnd === null || quietHoursEnd === undefined) return false;
  if (quietHoursStart === quietHoursEnd) return false;

  if (quietHoursStart < quietHoursEnd) {
    return hourOfDay >= quietHoursStart && hourOfDay < quietHoursEnd;
  }
  return hourOfDay >= quietHoursStart || hourOfDay < quietHoursEnd;
}

export function isChannelEnabled(toggles: ChannelToggleMap | null | undefined, channel: string): boolean {
  if (!toggles) return true;
  return toggles[channel] !== false;
}

export function isCategoryEnabled(toggles: CategoryToggleMap | null | undefined, category: string): boolean {
  if (!toggles) return true;
  return toggles[category] !== false;
}

export type SuppressionReason = 'CHANNEL_DISABLED' | 'CATEGORY_DISABLED' | 'QUIET_HOURS' | 'FREQUENCY_LIMIT';

export interface SuppressionDecision {
  suppressed: boolean;
  reason?: SuppressionReason;
}

/** A single rate limit, keyed by channel or category in `FrequencyLimitMap`. Either bound is optional. */
export interface FrequencyLimit {
  maxPerHour?: number;
  maxPerDay?: number;
}

/** Keyed by channel code (e.g. `EMAIL`) or category code (e.g. `MARKETING`) — channel key wins when both match. */
export type FrequencyLimitMap = Record<string, FrequencyLimit>;

export interface PreferenceEvaluationContext {
  channel: string;
  category: string;
  priority: NotificationPriorityCode;
  hourOfDay: number;
  channelToggles?: ChannelToggleMap | null;
  categoryToggles?: CategoryToggleMap | null;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  frequencyLimits?: FrequencyLimitMap | null;
  /** Notifications already sent to this owner on this channel in the trailing hour (excluding suppressed). */
  recentHourCount?: number;
  /** Notifications already sent to this owner on this channel in the trailing 24h (excluding suppressed). */
  recentDayCount?: number;
}

function resolveFrequencyLimit(
  limits: FrequencyLimitMap | null | undefined,
  channel: string,
  category: string,
): FrequencyLimit | undefined {
  if (!limits) return undefined;
  return limits[channel] ?? limits[category];
}

/** True when either the hourly or daily cap for the resolved limit has already been reached. */
export function evaluateFrequencyLimit(limit: FrequencyLimit | undefined, recentHourCount = 0, recentDayCount = 0): boolean {
  if (!limit) return false;
  if (limit.maxPerHour !== undefined && recentHourCount >= limit.maxPerHour) return true;
  if (limit.maxPerDay !== undefined && recentDayCount >= limit.maxPerDay) return true;
  return false;
}

/**
 * Determines whether a notification should be suppressed based on the recipient's saved
 * preferences. CRITICAL priority notifications always bypass quiet-hours and frequency-limit
 * suppression (but not explicit channel/category opt-outs) since they represent
 * security-relevant alerts that must not be throttled.
 */
export function evaluatePreferenceSuppression(ctx: PreferenceEvaluationContext): SuppressionDecision {
  if (!isChannelEnabled(ctx.channelToggles, ctx.channel)) {
    return { suppressed: true, reason: 'CHANNEL_DISABLED' };
  }
  if (!isCategoryEnabled(ctx.categoryToggles, ctx.category)) {
    return { suppressed: true, reason: 'CATEGORY_DISABLED' };
  }
  if (ctx.priority !== 'CRITICAL') {
    if (isWithinQuietHours(ctx.hourOfDay, ctx.quietHoursStart, ctx.quietHoursEnd)) {
      return { suppressed: true, reason: 'QUIET_HOURS' };
    }
    const limit = resolveFrequencyLimit(ctx.frequencyLimits, ctx.channel, ctx.category);
    if (evaluateFrequencyLimit(limit, ctx.recentHourCount, ctx.recentDayCount)) {
      return { suppressed: true, reason: 'FREQUENCY_LIMIT' };
    }
  }
  return { suppressed: false };
}
