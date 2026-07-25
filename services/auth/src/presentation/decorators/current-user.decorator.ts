import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { JwtAccessClaims } from '@auvora/types';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtAccessClaims => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtAccessClaims }>();
    return request.user;
  },
);

export function extractRequestContext(req: Request): { ipAddress?: string; userAgent?: string } {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : req.ip ?? req.socket.remoteAddress ?? undefined;
  const userAgent = req.headers['user-agent'];
  return { ipAddress, userAgent };
}
