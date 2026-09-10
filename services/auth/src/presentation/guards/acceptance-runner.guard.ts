import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';

const RUNNER_REDIS_KEY = 'auvora:acceptance:runner-key';
const RUNNER_HEADER = 'x-acceptance-runner-key';

@Injectable()
export class AcceptanceRunnerGuard implements CanActivate {
  constructor(@Inject(REDIS_PORT) private readonly redis: RedisPort) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header(RUNNER_HEADER);
    if (!provided) {
      throw new UnauthorizedException('Invalid acceptance runner key');
    }

    const expected = await this.redis.getClient().get(RUNNER_REDIS_KEY);
    if (!expected) {
      throw new UnauthorizedException('Acceptance runner inactive');
    }

    if (!safeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid acceptance runner key');
    }

    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
