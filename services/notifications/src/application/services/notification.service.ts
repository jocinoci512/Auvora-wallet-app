import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPriority,
  type NotificationStatus,
  type Prisma,
} from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  EVENT_BUS,
  ForbiddenError,
  NotFoundError,
  NotificationEventType,
  PERMISSION_NOTIFICATION_ADMIN,
  renderTemplateParts,
  ValidationError,
  type EventBusPort,
  type TemplateFormatCode,
} from '../../domain';
import { PreferenceService } from './preference.service';
import { QueueService } from './queue.service';
import { TemplateService } from './template.service';

export interface SendNotificationInput {
  ownerUserId?: string;
  templateId?: string;
  templateCode?: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  priority?: NotificationPriority;
  recipient: string;
  subject?: string;
  body?: string;
  variables?: Record<string, unknown>;
  dedupeKey?: string;
  correlationId?: string;
  /** Event type on the originating service (e.g. `payment.completed`) — links this notification back to its trigger. */
  sourceEventType?: string;
  /** Aggregate/event id on the originating service, paired with `sourceEventType`. */
  sourceEventId?: string;
  scheduledAt?: Date;
  delayUntil?: Date;
  maxAttempts?: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(TemplateService) private readonly templates: TemplateService,
    @Inject(PreferenceService) private readonly preferences: PreferenceService,
    @Inject(QueueService) private readonly queue: QueueService,
  ) {}

  async send(input: SendNotificationInput) {
    if (input.dedupeKey) {
      const existing = await this.prisma.notificationMessage.findUnique({
        where: { dedupeKey: input.dedupeKey },
      });
      if (existing) {
        return existing;
      }
    }

    let subject = input.subject;
    let body = input.body;
    let templateId: string | undefined = input.templateId;

    if (input.templateId || input.templateCode) {
      const template = input.templateId
        ? await this.templates.get(input.templateId)
        : await this.templates.getByCode(
            input.templateCode as string,
            input.channel,
            typeof input.metadata?.['locale'] === 'string'
              ? (input.metadata['locale'] as string)
              : 'en',
          );
      const rendered = renderTemplateParts(
        { subject: template.subject ?? undefined, body: template.body },
        input.variables ?? {},
        template.format as TemplateFormatCode,
      );
      subject = rendered.subject ?? subject;
      body = rendered.body;
      templateId = template.id;
    }

    if (!body) {
      throw new ValidationError('Notification body or template is required');
    }

    const priority: NotificationPriority = input.priority ?? 'NORMAL';

    let suppressed = false;
    let suppressionReason: string | undefined;
    if (input.ownerUserId) {
      const decision = await this.preferences.evaluateSuppression(
        input.ownerUserId,
        input.channel,
        input.category,
        priority,
      );
      suppressed = decision.suppressed;
      suppressionReason = decision.reason;
    }

    const availableAt = input.scheduledAt ?? input.delayUntil;
    const status: NotificationStatus = suppressed
      ? 'SUPPRESSED'
      : availableAt
        ? 'SCHEDULED'
        : 'QUEUED';
    // Every notification carries a correlationId so it can be traced end-to-end (delivery logs,
    // webhook fan-out, upstream service logs) even when the caller does not supply one.
    const correlationId = input.correlationId ?? randomUUID();

    const created = await this.prisma.notificationMessage.create({
      data: {
        ownerUserId: input.ownerUserId,
        templateId,
        category: input.category,
        channel: input.channel,
        priority,
        status,
        subject,
        body,
        payload: (input.variables ?? {}) as Prisma.InputJsonValue,
        dedupeKey: input.dedupeKey,
        correlationId,
        sourceEventType: input.sourceEventType,
        sourceEventId: input.sourceEventId,
        scheduledAt: input.scheduledAt,
        delayUntil: input.delayUntil,
        maxAttempts: input.maxAttempts ?? 5,
        metadata: {
          ...(input.metadata ?? {}),
          recipient: input.recipient,
          suppressionReason,
          sourceEventType: input.sourceEventType,
          sourceEventId: input.sourceEventId,
        } as Prisma.InputJsonValue,
      },
    });

    if (!suppressed) {
      await this.queue.enqueue(created.id, { priority, availableAt });
    }

    await this.events.publish({
      type: NotificationEventType.NotificationQueued,
      aggregateId: created.id,
      correlationId,
      payload: { channel: input.channel, category: input.category, suppressed },
    });

    return created;
  }

  async sendBatch(items: SendNotificationInput[]) {
    const results = [];
    for (const item of items) {
      results.push(await this.send(item));
    }
    return results;
  }

  async history(
    ownerUserId: string,
    filters: { status?: NotificationStatus; skip?: number; take?: number } = {},
  ) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 100);
    const where: Prisma.NotificationMessageWhereInput = {
      ownerUserId,
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notificationMessage.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async search(
    filters: {
      status?: NotificationStatus;
      channel?: NotificationChannel;
      category?: NotificationCategory;
      ownerUserId?: string;
      skip?: number;
      take?: number;
    } = {},
  ) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 200);
    const where: Prisma.NotificationMessageWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notificationMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notificationMessage.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async get(id: string) {
    return this.getOrThrow(id);
  }

  async status(id: string) {
    const notification = await this.getOrThrow(id);
    const logs = await this.prisma.notificationDeliveryLog.findMany({
      where: { notificationId: id },
      orderBy: { createdAt: 'desc' },
    });
    return { notification, deliveryLogs: logs };
  }

  async markRead(id: string, actor: JwtAccessClaims) {
    const notification = await this.getOrThrow(id);
    this.assertSelfOrAdmin(notification.ownerUserId, actor);
    const metadata = {
      ...((notification.metadata as Record<string, unknown>) ?? {}),
      read: true,
      readAt: new Date().toISOString(),
    };
    return this.prisma.notificationMessage.update({
      where: { id },
      data: {
        status:
          notification.status === 'FAILED' || notification.status === 'DEAD_LETTER'
            ? notification.status
            : 'DELIVERED',
        deliveredAt: notification.deliveredAt ?? new Date(),
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async listInbox(ownerUserId: string, filters: { skip?: number; take?: number } = {}) {
    return this.history(ownerUserId, { ...filters, status: undefined });
  }

  private async getOrThrow(id: string) {
    const notification = await this.prisma.notificationMessage.findUnique({ where: { id } });
    if (!notification) throw new NotFoundError('Notification not found');
    return notification;
  }

  private assertSelfOrAdmin(ownerUserId: string | null, requester: JwtAccessClaims) {
    if (
      ownerUserId !== requester.sub &&
      !requester.permissions.includes(PERMISSION_NOTIFICATION_ADMIN)
    ) {
      throw new ForbiddenError('Access denied');
    }
  }
}
