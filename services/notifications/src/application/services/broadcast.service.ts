import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationPriority,
} from '@auvora/database';
import { ValidationError } from '../../domain';
import { NotificationService } from './notification.service';

export interface BroadcastInput {
  category: NotificationCategory;
  channel: NotificationChannel;
  priority?: NotificationPriority;
  subject?: string;
  body: string;
  roles?: string[];
  userIds?: string[];
  all?: boolean;
  metadata?: Record<string, unknown>;
}

const BROADCAST_RECIPIENT_CAP = 5_000;

@Injectable()
export class BroadcastService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationService) private readonly notifications: NotificationService,
  ) {}

  async broadcast(actorUserId: string, input: BroadcastInput) {
    const targetUserIds = await this.resolveTargets(input);
    if (targetUserIds.length === 0) {
      throw new ValidationError('Broadcast has no resolvable recipients');
    }

    const broadcastId = randomUUID();
    const results = await this.notifications.sendBatch(
      targetUserIds.map((ownerUserId) => ({
        ownerUserId,
        category: input.category,
        channel: input.channel,
        priority: input.priority ?? 'NORMAL',
        recipient: ownerUserId,
        subject: input.subject,
        body: input.body,
        correlationId: broadcastId,
        metadata: { ...(input.metadata ?? {}), broadcastId, broadcastBy: actorUserId },
      })),
    );

    return { broadcastId, recipientCount: targetUserIds.length, notifications: results };
  }

  private async resolveTargets(input: BroadcastInput): Promise<string[]> {
    if (input.userIds && input.userIds.length > 0) {
      return Array.from(new Set(input.userIds)).slice(0, BROADCAST_RECIPIENT_CAP);
    }

    if (input.roles && input.roles.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null, roles: { some: { role: { name: { in: input.roles } } } } },
        select: { id: true },
        take: BROADCAST_RECIPIENT_CAP,
      });
      return users.map((user) => user.id);
    }

    if (input.all) {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true },
        take: BROADCAST_RECIPIENT_CAP,
      });
      return users.map((user) => user.id);
    }

    throw new ValidationError('Broadcast requires userIds, roles, or all=true');
  }
}
