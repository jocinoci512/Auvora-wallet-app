import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { RequestCachePort } from '../../application/ports/provider.tokens';
import { REDIS_PORT, type RedisPort } from './redis.port';
import type { RedisAdapter } from './redis.adapter';

const CACHE_PREFIX = 'ai:request-cache:';

@Injectable()
export class RequestCacheAdapter implements RequestCachePort {
  constructor(@Inject(REDIS_PORT) private readonly redis: RedisPort) {}

  buildKey(prompt: string, model: string): string {
    const hash = createHash('sha256').update(`${model}::${prompt}`).digest('hex');
    return `${CACHE_PREFIX}${hash}`;
  }

  async get(key: string): Promise<string | null> {
    return (this.redis as RedisAdapter).getCached(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await (this.redis as RedisAdapter).setCached(key, value, ttlSeconds);
  }
}
