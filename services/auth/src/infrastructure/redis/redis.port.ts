import type Redis from 'ioredis';

export const REDIS_PORT = Symbol('REDIS_PORT');

export interface RedisPort {
  ping(): Promise<boolean>;
  /** The shared command/publish connection. Never exposed outside the mesh. */
  getClient(): Redis;
  /** A dedicated duplicated connection for Redis subscribe mode. */
  createSubscriber(): Redis;
}
