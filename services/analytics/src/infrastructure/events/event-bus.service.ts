import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DomainEvent, EventBusPort } from '../../domain';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

export const ANALYTICS_EVENTS_CHANNEL = 'auvora:analytics:events';

@Injectable()
export class EventBusService implements EventBusPort {
  private readonly logger = new Logger(EventBusService.name);

  constructor(@Inject(REDIS_PORT) private readonly redis: RedisPort) {}

  async publish(input: DomainEvent): Promise<void> {
    try {
      await this.redis.getClient().publish(
        ANALYTICS_EVENTS_CHANNEL,
        JSON.stringify({ ...input, publishedAt: new Date().toISOString() }),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to publish event ${input.type}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
