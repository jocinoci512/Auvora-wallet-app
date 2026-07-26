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
  // Prefer the rightmost hop (gateway-added). Never trust the leftmost client-supplied value.
  const forwarded = req.headers['x-forwarded-for'];
  let ipAddress: string | undefined;
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const hops = forwarded.split(',').map((part) => part.trim()).filter(Boolean);
    ipAddress = hops[hops.length - 1];
  } else {
    ipAddress = req.ip ?? req.socket.remoteAddress ?? undefined;
  }
  const userAgent = req.headers['user-agent'];
  return { ipAddress, userAgent };
}
