import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { RateLimiterPort } from '../../application/ports/rate-limiter.port';
import type { RedisPort } from '../redis/redis.port';

@Injectable()
export class RedisAdapter implements RedisPort, RateLimiterPort, OnModuleDestroy {
  private readonly logger = new Logger(RedisAdapter.name);
  private readonly client: Redis;

  constructor(@Inject(ENV) env: ServiceEnv) {
    this.client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Bounded reconnect backoff for managed Redis (Railway private networking).
      retryStrategy: (times: number) => {
        if (times > 10) {
          return null;
        }
        return Math.min(times * 200, 3_000);
      },
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

  createSubscriber(): Redis {
    // Duplicate inherits the same connection options (incl. bounded retryStrategy)
    // but is an independent connection required for Redis subscribe mode.
    return this.client.duplicate();
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

  async denylistToken(tokenHash: string, ttlSeconds: number): Promise<void> {
    await this.client.setex(`denylist:${tokenHash}`, ttlSeconds, '1');
  }

  async isDenylisted(tokenHash: string): Promise<boolean> {
    const value = await this.client.get(`denylist:${tokenHash}`);
    return value === '1';
  }
}
