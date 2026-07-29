import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { CORRELATION_ID_HEADER } from '@auvora/security';
import type { JwtAccessClaims } from '@auvora/types';
import type { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtAccessClaims => {
    const request = ctx.switchToHttp().getRequest<Request & { user: JwtAccessClaims }>();
    return request.user;
  },
);

/**
 * Reads the inbound `x-correlation-id` header (normalized/defaulted by RequestContextMiddleware
 * for external requests). Governance-relevant routes should prefer any client-supplied
 * `correlationId` in the request body over this and only fall back to the header.
 */
export const CorrelationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const header = request.headers[CORRELATION_ID_HEADER];
    return Array.isArray(header) ? header[0] : header;
  },
);

export function extractRequestContext(req: Request): { ipAddress?: string; userAgent?: string } {
  // Prefer the rightmost hop (gateway-added). Never trust the leftmost client-supplied value.
  const forwarded = req.headers['x-forwarded-for'];
  let ipAddress: string | undefined;
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    const hops = forwarded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    ipAddress = hops[hops.length - 1];
  } else {
    ipAddress = req.ip ?? req.socket.remoteAddress ?? undefined;
  }
  const userAgent = req.headers['user-agent'];
  return { ipAddress, userAgent };
}
