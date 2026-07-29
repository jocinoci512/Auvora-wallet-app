import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, type Prisma } from '@auvora/database';
import type { DomainEvent, EventBusPort } from '../../domain';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

export const NOTIFICATION_EVENTS_CHANNEL = 'auvora:notifications:events';

@Injectable()
export class EventBusService implements EventBusPort {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async publish(input: DomainEvent): Promise<void> {
    await this.prisma.notificationEventLog.create({
      data: {
        eventType: input.type,
        aggregateId: input.aggregateId,
        payload: input.payload as Prisma.InputJsonValue,
        correlationId: input.correlationId,
      },
    });

    try {
      await this.redis
        .getClient()
        .publish(
          NOTIFICATION_EVENTS_CHANNEL,
          JSON.stringify({ ...input, publishedAt: new Date().toISOString() }),
        );
    } catch (error) {
      this.logger.warn(
        `Failed to publish event ${input.type}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
