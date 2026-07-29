import { createHash, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ENV, type ServiceEnv } from '../../config/env.schema';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers['x-internal-api-key'];
    if (typeof provided !== 'string' || provided.length === 0) {
      throw new UnauthorizedException('Internal API key required');
    }
    const expected = this.env.INTERNAL_API_KEY;
    const a = createHash('sha256').update(provided).digest();
    const b = createHash('sha256').update(expected).digest();
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}
