import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService, type Prisma } from '@auvora/database';
import type { EventBusPort, PublishEventInput } from '../../domain';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

export const BLOCKCHAIN_EVENTS_CHANNEL = 'auvora:blockchain:events';

@Injectable()
export class EventBusService implements EventBusPort {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async publish(input: PublishEventInput): Promise<void> {
    await this.prisma.blockchainEventLog.create({
      data: {
        eventType: input.type,
        chain: input.chain,
        aggregateId: input.aggregateId,
        payload: input.payload as Prisma.InputJsonValue,
        correlationId: input.correlationId,
      },
    });

    const message = JSON.stringify({
      type: input.type,
      chain: input.chain,
      aggregateId: input.aggregateId,
      payload: input.payload,
      correlationId: input.correlationId,
      publishedAt: new Date().toISOString(),
    });

    try {
      await this.redis.getClient().publish(BLOCKCHAIN_EVENTS_CHANNEL, message);
    } catch (error) {
      this.logger.warn(
        `Failed to publish event ${input.type} to redis: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
