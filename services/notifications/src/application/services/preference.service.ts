import { Inject, Injectable } from '@nestjs/common';
import { PrismaService, type NotificationCategory, type NotificationChannel, type Prisma } from '@auvora/database';
import {
  EVENT_BUS,
  evaluatePreferenceSuppression,
  NotificationEventType,
  type ChannelToggleMap,
  type CategoryToggleMap,
  type EventBusPort,
  type FrequencyLimitMap,
  type NotificationPriorityCode,
  type SuppressionDecision,
} from '../../domain';

export interface UpsertPreferenceInput {
  language?: string;
  timeZone?: string;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  digestEnabled?: boolean;
  digestHour?: number | null;
  channelToggles?: ChannelToggleMap;
  categoryToggles?: CategoryToggleMap;
  frequencyLimits?: Record<string, unknown>;
}

const DEFAULT_PREFERENCE = {
  language: 'en',
  timeZone: 'UTC',
  quietHoursStart: null as number | null,
  quietHoursEnd: null as number | null,
  digestEnabled: false,
  digestHour: null as number | null,
  channelToggles: {} as ChannelToggleMap,
  categoryToggles: {} as CategoryToggleMap,
  frequencyLimits: null,
};

function hourOfDayInTimeZone(timeZone: string, at: Date): number {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hour12: false }).format(at);
    const hour = Number.parseInt(formatted, 10);
    return Number.isNaN(hour) ? at.getUTCHours() : hour % 24;
  } catch {
    return at.getUTCHours();
  }
}

@Injectable()
export class PreferenceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async get(ownerUserId: string) {
    const preference = await this.prisma.notificationPreference.findUnique({ where: { ownerUserId } });
    if (!preference) {
      return { ownerUserId, ...DEFAULT_PREFERENCE };
    }
    return preference;
  }

  async upsert(ownerUserId: string, input: UpsertPreferenceInput) {
    const data = {
      language: input.language,
      timeZone: input.timeZone,
      quietHoursStart: input.quietHoursStart,
      quietHoursEnd: input.quietHoursEnd,
      digestEnabled: input.digestEnabled,
      digestHour: input.digestHour,
      channelToggles: input.channelToggles as Prisma.InputJsonValue | undefined,
      categoryToggles: input.categoryToggles as Prisma.InputJsonValue | undefined,
      frequencyLimits: input.frequencyLimits as Prisma.InputJsonValue | undefined,
    };

    const updated = await this.prisma.notificationPreference.upsert({
      where: { ownerUserId },
      create: {
        ownerUserId,
        language: input.language ?? DEFAULT_PREFERENCE.language,
        timeZone: input.timeZone ?? DEFAULT_PREFERENCE.timeZone,
        quietHoursStart: input.quietHoursStart ?? undefined,
        quietHoursEnd: input.quietHoursEnd ?? undefined,
        digestEnabled: input.digestEnabled ?? DEFAULT_PREFERENCE.digestEnabled,
        digestHour: input.digestHour ?? undefined,
        channelToggles: (input.channelToggles ?? {}) as Prisma.InputJsonValue,
        categoryToggles: (input.categoryToggles ?? {}) as Prisma.InputJsonValue,
        frequencyLimits: input.frequencyLimits as Prisma.InputJsonValue | undefined,
      },
      update: data,
    });

    await this.events.publish({
      type: NotificationEventType.PreferenceUpdated,
      aggregateId: ownerUserId,
      payload: { ownerUserId },
    });

    return updated;
  }

  async evaluateSuppression(
    ownerUserId: string,
    channel: NotificationChannel,
    category: NotificationCategory,
    priority: NotificationPriorityCode,
    at: Date = new Date(),
  ): Promise<SuppressionDecision> {
    const preference = await this.get(ownerUserId);
    const hourOfDay = hourOfDayInTimeZone(preference.timeZone, at);
    const frequencyLimits = (preference.frequencyLimits as FrequencyLimitMap | null) ?? null;

    const hasLimit = Boolean(frequencyLimits && (frequencyLimits[channel] || frequencyLimits[category]));
    const { recentHourCount, recentDayCount } = hasLimit
      ? await this.countRecentDeliveries(ownerUserId, channel, at)
      : { recentHourCount: 0, recentDayCount: 0 };

    return evaluatePreferenceSuppression({
      channel,
      category,
      priority,
      hourOfDay,
      channelToggles: preference.channelToggles as ChannelToggleMap | null,
      categoryToggles: preference.categoryToggles as CategoryToggleMap | null,
      quietHoursStart: preference.quietHoursStart,
      quietHoursEnd: preference.quietHoursEnd,
      frequencyLimits,
      recentHourCount,
      recentDayCount,
    });
  }

  /** Counts non-suppressed notifications already created for this owner+channel in the trailing hour/day, for frequency-limit checks. */
  private async countRecentDeliveries(
    ownerUserId: string,
    channel: NotificationChannel,
    at: Date,
  ): Promise<{ recentHourCount: number; recentDayCount: number }> {
    const hourAgo = new Date(at.getTime() - 60 * 60 * 1000);
    const dayAgo = new Date(at.getTime() - 24 * 60 * 60 * 1000);
    const [recentHourCount, recentDayCount] = await Promise.all([
      this.prisma.notificationMessage.count({
        where: { ownerUserId, channel, status: { not: 'SUPPRESSED' }, createdAt: { gte: hourAgo, lte: at } },
      }),
      this.prisma.notificationMessage.count({
        where: { ownerUserId, channel, status: { not: 'SUPPRESSED' }, createdAt: { gte: dayAgo, lte: at } },
      }),
    ]);
    return { recentHourCount, recentDayCount };
  }
}
