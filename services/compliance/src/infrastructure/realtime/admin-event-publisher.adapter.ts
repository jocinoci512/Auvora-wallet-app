import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

export const ADMIN_EVENT_PUBLISHER = Symbol('ADMIN_EVENT_PUBLISHER');
export const ADMIN_EVENTS_CHANNEL = 'auvora:admin:events';

export interface AdminEventInput {
  type: 'COMPLIANCE_STATUS_CHANGED';
  severity?: 'info' | 'warning' | 'critical';
  userId?: string;
  targetId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface AdminEventPublisherPort {
  publish(input: AdminEventInput): Promise<void>;
}

@Injectable()
export class RedisAdminEventPublisher implements AdminEventPublisherPort {
  private readonly logger = new Logger(RedisAdminEventPublisher.name);

  constructor(@Inject(REDIS_PORT) private readonly redis: RedisPort) {}

  async publish(input: AdminEventInput): Promise<void> {
    const envelope: Record<string, unknown> = {
      id: `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      type: input.type,
      timestamp: new Date().toISOString(),
      service: 'compliance',
      severity: input.severity ?? 'info',
    };
    if (input.userId) envelope.userId = String(input.userId).slice(0, 128);
    if (input.targetId) envelope.targetId = String(input.targetId).slice(0, 128);
    if (input.metadata) {
      const safe: Record<string, string | number | boolean | null> = {};
      for (const [k, v] of Object.entries(input.metadata)) {
        if (v === undefined) continue;
        if (/password|secret|token|mnemonic|private|document|storage/i.test(k)) continue;
        safe[k] = typeof v === 'string' ? v.slice(0, 512) : v;
      }
      if (Object.keys(safe).length > 0) envelope.metadata = safe;
    }
    try {
      await this.redis.getClient().publish(ADMIN_EVENTS_CHANNEL, JSON.stringify(envelope));
    } catch (error) {
      this.logger.warn(
        `Failed to publish admin event ${input.type}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
