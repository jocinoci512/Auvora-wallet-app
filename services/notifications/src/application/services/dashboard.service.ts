import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { CHANNEL_PROVIDER_REGISTRY } from '../ports/provider.tokens';
import {
  NotFoundError,
  type ChannelProviderRegistryPort,
  type NotificationChannelCode,
} from '../../domain';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CHANNEL_PROVIDER_REGISTRY) private readonly providers: ChannelProviderRegistryPort,
  ) {}

  async metrics() {
    const [
      sent,
      delivered,
      failed,
      deadLetter,
      queued,
      sending,
      avgLatency,
      deliveryCount,
      successCount,
    ] = await Promise.all([
      this.prisma.notificationMessage.count({ where: { status: 'SENT' } }),
      this.prisma.notificationMessage.count({ where: { status: 'DELIVERED' } }),
      this.prisma.notificationMessage.count({ where: { status: 'FAILED' } }),
      this.prisma.notificationMessage.count({ where: { status: 'DEAD_LETTER' } }),
      this.prisma.notificationQueueItem.count({ where: { status: 'QUEUED' } }),
      this.prisma.notificationQueueItem.count({ where: { status: 'SENDING' } }),
      this.prisma.notificationDeliveryLog.aggregate({ _avg: { latencyMs: true } }),
      this.prisma.notificationDeliveryLog.count(),
      this.prisma.notificationDeliveryLog.count({ where: { success: true } }),
    ]);

    const providerHealth = await Promise.all(
      (await this.providers.listAll()).map(async (provider) => provider.health()),
    );

    const successRate = deliveryCount > 0 ? successCount / deliveryCount : 1;

    return {
      sent,
      delivered,
      failed,
      deadLetter,
      queueLength: queued + sending,
      averageLatencyMs: avgLatency._avg.latencyMs ?? 0,
      successRate,
      providerHealth,
    };
  }

  async listProviders() {
    return this.prisma.notificationChannelProvider.findMany({ orderBy: { priority: 'asc' } });
  }

  /** Toggles a `notification_channel_providers` row without a deploy — see admin `providers/:id/enable|disable`. */
  async setProviderEnabled(id: string, isEnabled: boolean) {
    const provider = await this.prisma.notificationChannelProvider.findUnique({ where: { id } });
    if (!provider) throw new NotFoundError('Channel provider not found');
    return this.prisma.notificationChannelProvider.update({ where: { id }, data: { isEnabled } });
  }

  /** Re-runs health checks for every channel backend and persists the result for the matching provider row(s). */
  async refreshHealth() {
    const providers = await this.providers.listAll();
    const results = await Promise.all(
      providers.map(async (provider) => ({
        channel: provider.getChannel(),
        health: await provider.health(),
      })),
    );

    await Promise.all(
      results.map(({ channel, health }) =>
        this.prisma.notificationChannelProvider.updateMany({
          where: { channel: channel as NotificationChannelCode },
          data: {
            healthStatus: health.healthy ? 'HEALTHY' : 'UNHEALTHY',
            lastCheckedAt: health.checkedAt,
          },
        }),
      ),
    );

    return results;
  }

  async auditTrail(skip = 0, take = 50) {
    const [items, total] = await Promise.all([
      this.prisma.notificationAuditRecord.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 200),
      }),
      this.prisma.notificationAuditRecord.count(),
    ]);
    return { items, total, skip, take };
  }
}
