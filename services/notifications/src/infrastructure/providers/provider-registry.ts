import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import type {
  ChannelProviderPort,
  ChannelProviderRegistryPort,
  NotificationChannelCode,
} from '../../domain';
import { ProviderUnavailableError } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { HttpChannelProvider } from './http-channel.provider';
import { LocalInAppProvider } from './local-in-app.provider';
import { SimulatorChannelProvider } from './simulator.provider';
import { UnavailableChannelProvider } from './unavailable.provider';

const ALL_CHANNELS: NotificationChannelCode[] = [
  'EMAIL',
  'SMS',
  'PUSH',
  'IN_APP',
  'BROWSER',
  'WEBHOOK',
  'SLACK',
  'TEAMS',
];

/** Channels backed by a real HTTP provider when the simulator is off, keyed to their env vars. */
const HTTP_PROVIDER_ENV: Partial<
  Record<NotificationChannelCode, { url: keyof ServiceEnv; token: keyof ServiceEnv }>
> = {
  EMAIL: { url: 'NOTIFICATIONS_EMAIL_PROVIDER_URL', token: 'NOTIFICATIONS_EMAIL_PROVIDER_TOKEN' },
  SMS: { url: 'NOTIFICATIONS_SMS_PROVIDER_URL', token: 'NOTIFICATIONS_SMS_PROVIDER_TOKEN' },
  PUSH: { url: 'NOTIFICATIONS_PUSH_PROVIDER_URL', token: 'NOTIFICATIONS_PUSH_PROVIDER_TOKEN' },
  SLACK: { url: 'NOTIFICATIONS_SLACK_PROVIDER_URL', token: 'NOTIFICATIONS_SLACK_PROVIDER_TOKEN' },
  TEAMS: { url: 'NOTIFICATIONS_TEAMS_PROVIDER_URL', token: 'NOTIFICATIONS_TEAMS_PROVIDER_TOKEN' },
};

/** Channels that are platform-owned deliveries with no external network hop required. */
const LOCAL_DELIVERY_CHANNELS: NotificationChannelCode[] = ['IN_APP', 'BROWSER', 'WEBHOOK'];

/** Per-channel env kill switch — checked before the DB-backed provider table. */
const CHANNEL_ENV_FLAG: Record<NotificationChannelCode, keyof ServiceEnv> = {
  EMAIL: 'NOTIFICATIONS_CHANNEL_EMAIL_ENABLED',
  SMS: 'NOTIFICATIONS_CHANNEL_SMS_ENABLED',
  PUSH: 'NOTIFICATIONS_CHANNEL_PUSH_ENABLED',
  IN_APP: 'NOTIFICATIONS_CHANNEL_IN_APP_ENABLED',
  BROWSER: 'NOTIFICATIONS_CHANNEL_BROWSER_ENABLED',
  WEBHOOK: 'NOTIFICATIONS_CHANNEL_WEBHOOK_ENABLED',
  SLACK: 'NOTIFICATIONS_CHANNEL_SLACK_ENABLED',
  TEAMS: 'NOTIFICATIONS_CHANNEL_TEAMS_ENABLED',
};

/**
 * Resolves the concrete channel backend strategy for a given notification channel.
 *
 * Enable/disable state is layered so operators can toggle channels without a deploy:
 *  1. `NOTIFICATIONS_CHANNEL_<CHANNEL>_ENABLED` env flag — a hard kill switch, checked first.
 *  2. `notification_channel_providers` DB rows (`channel`, `isEnabled=true`, ordered by
 *     `priority`) — the operator-managed source of truth (see admin `providers/:id/enable`).
 *  3. The concrete backend (simulator / HTTP provider / local in-app / unavailable) is still
 *     selected from env at boot, since credentials/URLs must never come from request input.
 */
@Injectable()
export class ChannelProviderRegistry implements ChannelProviderRegistryPort {
  private readonly backends = new Map<NotificationChannelCode, ChannelProviderPort>();

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    for (const channel of ALL_CHANNELS) {
      this.backends.set(channel, this.buildBackend(channel));
    }
  }

  private buildBackend(channel: NotificationChannelCode): ChannelProviderPort {
    if (this.env.NOTIFICATIONS_SIMULATOR_ENABLED) {
      return new SimulatorChannelProvider(channel);
    }

    const httpEnv = HTTP_PROVIDER_ENV[channel];
    const url = httpEnv ? (this.env[httpEnv.url] as string | undefined) : undefined;
    if (httpEnv && url) {
      const token = this.env[httpEnv.token] as string | undefined;
      return new HttpChannelProvider(channel, { url, token });
    }

    if (LOCAL_DELIVERY_CHANNELS.includes(channel)) {
      return new LocalInAppProvider(channel);
    }

    return new UnavailableChannelProvider(channel);
  }

  private isEnabledByEnv(channel: NotificationChannelCode): boolean {
    return this.env[CHANNEL_ENV_FLAG[channel]] !== false;
  }

  async resolve(channel: NotificationChannelCode): Promise<ChannelProviderPort> {
    if (!this.isEnabledByEnv(channel)) {
      return new UnavailableChannelProvider(channel);
    }

    const enabledRow = await this.prisma.notificationChannelProvider.findFirst({
      where: { channel, isEnabled: true },
      orderBy: { priority: 'asc' },
    });

    if (!enabledRow) {
      throw new ProviderUnavailableError(`No enabled provider configured for channel ${channel}`);
    }

    return this.backends.get(channel) ?? new UnavailableChannelProvider(channel);
  }

  async listAll(): Promise<ChannelProviderPort[]> {
    return Promise.resolve(
      ALL_CHANNELS.map((channel) => this.backends.get(channel) as ChannelProviderPort),
    );
  }
}
