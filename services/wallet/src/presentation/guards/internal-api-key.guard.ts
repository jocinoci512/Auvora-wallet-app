import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ENV, type ServiceEnv } from '../../config/env.schema';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.env.INTERNAL_API_KEY;
    if (!expected) {
      throw new UnauthorizedException('Internal API key is not configured');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-internal-api-key');
    if (!provided || !safeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid internal API key');
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
