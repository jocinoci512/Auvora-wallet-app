import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CSRF_TOKEN_COOKIE, CSRF_TOKEN_HEADER, timingSafeEqualString } from '@auvora/security';
import type { Request } from 'express';
import { IS_PUBLIC_KEY, SKIP_CSRF_KEY } from '../decorators/auth.decorators';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    const hasBearer =
      typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ');

    // Cookie-session browsers need CSRF; Bearer API clients are not CSRF-vulnerable the same way.
    if (!MUTATING_METHODS.has(request.method) || isPublic || skipCsrf || hasBearer) {
      return true;
    }

    const cookieToken = request.cookies?.[CSRF_TOKEN_COOKIE] as string | undefined;
    const headerToken = request.headers[CSRF_TOKEN_HEADER] as string | undefined;

    if (!cookieToken || !headerToken || !timingSafeEqualString(cookieToken, headerToken)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
