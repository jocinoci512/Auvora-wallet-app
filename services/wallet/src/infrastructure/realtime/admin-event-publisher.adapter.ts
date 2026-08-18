import { Inject, Injectable, Logger } from '@nestjs/common';
import { REDIS_PORT, type RedisPort } from '../redis/redis.port';

/**
 * Producer-side publisher for the canonical admin realtime channel
 * (`auvora:admin:events`). The auth-service hub is the authoritative subscriber
 * and re-sanitises every event before delivery, but we ALSO scrub here so no
 * secret is ever written to Redis. Fire-and-forget: a Redis outage must never
 * break a wallet domain flow.
 */
export const ADMIN_EVENT_PUBLISHER = Symbol('ADMIN_EVENT_PUBLISHER');
export const ADMIN_EVENTS_CHANNEL = 'auvora:admin:events';

export type AdminEventType =
  | 'WALLET_ADDED'
  | 'WALLET_REMOVED'
  | 'SIMULATION_BALANCE_CHANGED'
  | 'TRANSACTION_REVIEW_CREATED'
  | 'TRANSACTION_REVIEW_APPROVED'
  | 'TRANSACTION_REVIEW_REJECTED';
export type AdminEventSeverity = 'info' | 'warning' | 'critical';

export interface AdminEventInput {
  type: AdminEventType;
  severity?: AdminEventSeverity;
  userId?: string;
  targetId?: string;
  platform?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface AdminEventPublisherPort {
  publish(input: AdminEventInput): Promise<void>;
}

const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'secret',
  'token',
  'jwt',
  'bearer',
  'authorization',
  'cookie',
  'privatekey',
  'mnemonic',
  'seed',
  'symkey',
  'apikey',
  'encryptionkey',
  'ciphertext',
  'databaseurl',
  'redisurl',
  'connectionstring',
  'signature',
  'csrf',
  'vault',
];

function isSensitiveKey(key: string): boolean {
  const n = key.toLowerCase().replace(/[\s_-]/g, '');
  if (n === 'sessionid') return false;
  return SENSITIVE_KEY_FRAGMENTS.some((f) => n.includes(f.replace(/[\s_-]/g, '')));
}

function scrub(
  metadata: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (isSensitiveKey(k) || v === undefined) continue;
    if (v === null || typeof v === 'boolean') {
      out[k] = v;
    } else if (typeof v === 'number') {
      if (Number.isFinite(v)) out[k] = v;
    } else if (typeof v === 'string') {
      out[k] = v.slice(0, 512);
    }
  }
  return out;
}

let counter = 0;
function eventId(): string {
  counter = (counter + 1) % 1_000_000;
  return `evt_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

@Injectable()
export class RedisAdminEventPublisher implements AdminEventPublisherPort {
  private readonly logger = new Logger(RedisAdminEventPublisher.name);

  constructor(@Inject(REDIS_PORT) private readonly redis: RedisPort) {}

  async publish(input: AdminEventInput): Promise<void> {
    const envelope: Record<string, unknown> = {
      id: eventId(),
      type: input.type,
      timestamp: new Date().toISOString(),
      service: 'wallet',
      severity: input.severity ?? 'info',
    };
    if (input.userId) envelope.userId = String(input.userId).slice(0, 128);
    if (input.targetId) envelope.targetId = String(input.targetId).slice(0, 128);
    if (input.platform) envelope.platform = String(input.platform).slice(0, 32).toLowerCase();
    if (input.metadata) {
      const safe = scrub(input.metadata);
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
