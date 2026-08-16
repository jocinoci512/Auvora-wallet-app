import { Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import type { RedisPort } from './redis.port';

@Injectable()
export class NoopRedisAdapter implements RedisPort {
  async ping(): Promise<boolean> {
    return false;
  }

  getClient(): Redis {
    throw new Error('Redis is not available in the no-op adapter');
  }
}
