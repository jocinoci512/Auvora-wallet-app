import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, type NotificationStatus, type Prisma } from '@auvora/database';
import { CHANNEL_PROVIDER_REGISTRY } from '../ports/provider.tokens';
import {
  ConflictError,
  EVENT_BUS,
  NotFoundError,
  NotificationEventType,
  resolveFailureOutcome,
  sortByPriorityOrder,
  type ChannelProviderRegistryPort,
  type EventBusPort,
  type NotificationChannelCode,
  type NotificationPriorityCode,
} from '../../domain';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';

export interface EnqueueOptions {
  priority: NotificationPriorityCode;
  availableAt?: Date;
}

export interface QueueProcessResult {
  processed: boolean;
  queueItemId?: string;
  success?: boolean;
  errorMessage?: string;
}

const ACTIVE_QUEUE_STATUSES: NotificationStatus[] = ['QUEUED', 'SENDING'];

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CHANNEL_PROVIDER_REGISTRY) private readonly providers: ChannelProviderRegistryPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
  ) {}

  async enqueue(notificationId: string, options: EnqueueOptions) {
    return this.prisma.notificationQueueItem.create({
      data: {
        notificationId,
        priority: options.priority,
        status: 'QUEUED',
        availableAt: options.availableAt ?? new Date(),
      },
    });
  }

  /** Claims and processes a single queue item. Returns processed:false when the queue is empty. */
  async processNext(workerId = 'worker'): Promise<QueueProcessResult> {
    const now = new Date();
    const batch = await this.prisma.notificationQueueItem.findMany({
      where: { status: 'QUEUED', availableAt: { lte: now } },
      take: 25,
    });
    if (batch.length === 0) {
      return { processed: false };
    }

    const ordered = sortByPriorityOrder(
      batch.map((item) => ({ ...item, priority: item.priority as NotificationPriorityCode })),
    );

    for (const candidate of ordered) {
      const locked = await this.prisma.notificationQueueItem.updateMany({
        where: { id: candidate.id, status: 'QUEUED' },
        data: {
          status: 'SENDING',
          lockedAt: now,
          lockedBy: workerId,
          attemptCount: { increment: 1 },
        },
      });
      if (locked.count === 0) {
        continue;
      }
      return this.deliver(candidate.id);
    }

    return { processed: false };
  }

  private async deliver(queueItemId: string): Promise<QueueProcessResult> {
    const queueItem = await this.prisma.notificationQueueItem.findUnique({
      where: { id: queueItemId },
      include: { notification: true },
    });
    if (!queueItem) {
      return { processed: false };
    }
    const notification = queueItem.notification;

    try {
      const provider = await this.providers.resolve(
        notification.channel as NotificationChannelCode,
      );
      const metadata = (notification.metadata ?? {}) as Record<string, unknown>;
      const recipient =
        typeof metadata['recipient'] === 'string'
          ? (metadata['recipient'] as string)
          : (notification.ownerUserId ?? '');

      const result = await provider.send({
        notificationId: notification.id,
        recipient,
        subject: notification.subject ?? undefined,
        body: notification.body,
        metadata,
      });

      await this.prisma.notificationDeliveryLog.create({
        data: {
          notificationId: notification.id,
          channel: notification.channel,
          providerCode: result.providerCode,
          success: result.success,
          latencyMs: result.latencyMs,
          errorMessage: result.errorMessage,
          responseMeta: { correlationId: notification.correlationId } as Prisma.InputJsonValue,
        },
      });

      if (!result.success) {
        throw new Error(result.errorMessage ?? 'Delivery failed');
      }

      await this.prisma.notificationMessage.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          providerCode: result.providerCode,
          providerRef: result.providerRef,
        },
      });
      await this.prisma.notificationQueueItem.update({
        where: { id: queueItem.id },
        data: { status: 'SENT' },
      });

      await this.events.publish({
        type: NotificationEventType.NotificationSent,
        aggregateId: notification.id,
        correlationId: notification.correlationId ?? undefined,
        payload: { channel: notification.channel, providerCode: result.providerCode },
      });
      await this.ai.publishEvent({
        eventType: 'notification.sent',
        aggregateId: notification.id,
        correlationId: notification.correlationId ?? undefined,
        payload: { channel: notification.channel, providerCode: result.providerCode },
      });
      await this.analytics.publishEvent({
        eventType: 'notification.sent',
        domain: 'NOTIFICATIONS',
        aggregateId: notification.id,
        correlationId: notification.correlationId ?? undefined,
        ownerUserId: notification.ownerUserId ?? undefined,
        metrics: { notification_sent_count: 1 },
        payload: { channel: notification.channel, providerCode: result.providerCode },
      });

      return { processed: true, queueItemId: queueItem.id, success: true };
    } catch (error) {
      return this.handleFailure(queueItem.id, queueItem.attemptCount, notification, error);
    }
  }

  private async handleFailure(
    queueItemId: string,
    attemptCount: number,
    notification: {
      id: string;
      channel: string;
      maxAttempts: number;
      correlationId?: string | null;
    },
    error: unknown,
  ): Promise<QueueProcessResult> {
    const message = error instanceof Error ? error.message : String(error);
    const outcome = resolveFailureOutcome(attemptCount, { maxAttempts: notification.maxAttempts });

    if (outcome.outcome === 'DEAD_LETTER') {
      await this.prisma.notificationQueueItem.update({
        where: { id: queueItemId },
        data: { status: 'DEAD_LETTER', deadLetteredAt: new Date() },
      });
      await this.prisma.notificationMessage.update({
        where: { id: notification.id },
        data: { status: 'DEAD_LETTER', failedAt: new Date(), failureReason: message },
      });
      await this.events.publish({
        type: NotificationEventType.NotificationFailed,
        aggregateId: notification.id,
        correlationId: notification.correlationId ?? undefined,
        payload: { reason: message, deadLettered: true },
      });
    } else {
      await this.prisma.notificationQueueItem.update({
        where: { id: queueItemId },
        data: {
          status: 'QUEUED',
          availableAt: outcome.nextAttemptAt,
          nextAttemptAt: outcome.nextAttemptAt,
        },
      });
      await this.prisma.notificationMessage.update({
        where: { id: notification.id },
        data: { status: 'FAILED', failureReason: message },
      });
      await this.events.publish({
        type: NotificationEventType.NotificationFailed,
        aggregateId: notification.id,
        correlationId: notification.correlationId ?? undefined,
        payload: { reason: message, deadLettered: false },
      });
    }

    this.logger.warn(
      `Notification ${notification.id} delivery failed on ${notification.channel}: ${message}`,
    );
    return { processed: true, queueItemId, success: false, errorMessage: message };
  }

  async deadLetter(queueItemId: string, reason?: string) {
    const queueItem = await this.prisma.notificationQueueItem.findUnique({
      where: { id: queueItemId },
    });
    if (!queueItem) throw new NotFoundError('Queue item not found');
    const updated = await this.prisma.notificationQueueItem.update({
      where: { id: queueItemId },
      data: { status: 'DEAD_LETTER', deadLetteredAt: new Date() },
    });
    await this.prisma.notificationMessage.update({
      where: { id: queueItem.notificationId },
      data: {
        status: 'DEAD_LETTER',
        failedAt: new Date(),
        failureReason: reason ?? 'Manually dead-lettered',
      },
    });
    return updated;
  }

  async requeue(queueItemId: string) {
    const queueItem = await this.prisma.notificationQueueItem.findUnique({
      where: { id: queueItemId },
    });
    if (!queueItem) throw new NotFoundError('Queue item not found');
    if (queueItem.status !== 'DEAD_LETTER' && queueItem.status !== 'FAILED') {
      throw new ConflictError(`Cannot requeue a queue item in status ${queueItem.status}`);
    }
    const updated = await this.prisma.notificationQueueItem.update({
      where: { id: queueItemId },
      data: {
        status: 'QUEUED',
        availableAt: new Date(),
        attemptCount: 0,
        deadLetteredAt: null,
        nextAttemptAt: null,
      },
    });
    await this.prisma.notificationMessage.update({
      where: { id: queueItem.notificationId },
      data: { status: 'QUEUED' },
    });
    return updated;
  }

  async listQueue(filters: { status?: NotificationStatus; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.NotificationQueueItemWhereInput = filters.status
      ? { status: filters.status }
      : { status: { in: ACTIVE_QUEUE_STATUSES } };
    const [items, total] = await Promise.all([
      this.prisma.notificationQueueItem.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take,
      }),
      this.prisma.notificationQueueItem.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async listDeadLetter(skip = 0, take = 50) {
    const where: Prisma.NotificationQueueItemWhereInput = { status: 'DEAD_LETTER' };
    const [items, total] = await Promise.all([
      this.prisma.notificationQueueItem.findMany({
        where,
        orderBy: { deadLetteredAt: 'desc' },
        skip,
        take: Math.min(take, 200),
      }),
      this.prisma.notificationQueueItem.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async metrics() {
    const [queued, sending, deadLetter, failed] = await Promise.all([
      this.prisma.notificationQueueItem.count({ where: { status: 'QUEUED' } }),
      this.prisma.notificationQueueItem.count({ where: { status: 'SENDING' } }),
      this.prisma.notificationQueueItem.count({ where: { status: 'DEAD_LETTER' } }),
      this.prisma.notificationMessage.count({ where: { status: 'FAILED' } }),
    ]);
    return { queued, sending, deadLetter, failed };
  }
}
