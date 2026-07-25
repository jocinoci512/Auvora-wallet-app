import { Injectable } from '@nestjs/common';
import type { RedisPort } from './redis.port';

@Injectable()
export class NoopRedisAdapter implements RedisPort {
  async ping(): Promise<boolean> {
    return false;
  }
}
