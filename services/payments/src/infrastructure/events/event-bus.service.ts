import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, type Prisma } from '@auvora/database';
import type { EventBusPort, PublishEventInput } from '../../domain';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

export const PAYMENT_EVENTS_CHANNEL = 'auvora:payments:events';

@Injectable()
export class EventBusService implements EventBusPort {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async publish(input: PublishEventInput): Promise<void> {
    await this.prisma.paymentEventLog.create({
      data: {
        eventType: input.type,
        aggregateId: input.aggregateId,
        payload: input.payload as Prisma.InputJsonValue,
        correlationId: input.correlationId,
      },
    });

    const message = JSON.stringify({
      type: input.type,
      aggregateId: input.aggregateId,
      payload: input.payload,
      correlationId: input.correlationId,
      publishedAt: new Date().toISOString(),
    });

    try {
      await this.redis.getClient().publish(PAYMENT_EVENTS_CHANNEL, message);
    } catch (error) {
      this.logger.warn(
        `Failed to publish event ${input.type} to redis: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
