import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import type { RateLimiterPort } from '../../application/ports/clock.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { RedisPort } from '../redis/redis.port';

@Injectable()
export class RedisAdapter implements RedisPort, RateLimiterPort, OnModuleDestroy {
  private readonly logger = new Logger(RedisAdapter.name);
  private readonly client: Redis;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<boolean> {
    try {
      if (this.client.status !== 'ready') {
        await this.client.connect();
      }
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }> {
    const redisKey = `ratelimit:${key}`;
    const count = await this.client.incr(redisKey);
    if (count === 1) {
      await this.client.expire(redisKey, windowSeconds);
    }
    const allowed = count <= limit;
    return { allowed, remaining: Math.max(0, limit - count) };
  }
}
