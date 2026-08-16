import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ADMIN_EVENTS_CHANNEL,
  sanitizeAdminEvent,
  serializeAdminEvent,
  type AdminEventInput,
} from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { AdminEventPublisherPort } from '../../application/ports/admin-event-publisher.port';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

/**
 * Publishes sanitised admin events to Redis pub/sub. Sanitisation happens here so
 * a secret can never even be written to Redis. All failures are swallowed — the
 * realtime pipeline is best-effort notification transport, never a hard
 * dependency of auth flows.
 */
@Injectable()
export class RedisAdminEventPublisher implements AdminEventPublisherPort {
  private readonly logger = new Logger(RedisAdminEventPublisher.name);

  constructor(
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  async publish(input: AdminEventInput): Promise<void> {
    if (!this.env.ADMIN_REALTIME_ENABLED) return;
    const event = sanitizeAdminEvent(input);
    if (!event) {
      this.logger.debug(`Dropped unknown admin event type: ${String(input?.type)}`);
      return;
    }
    try {
      await this.redis.getClient().publish(ADMIN_EVENTS_CHANNEL, serializeAdminEvent(event));
    } catch (error) {
      this.logger.warn(
        `Failed to publish admin event ${event.type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
