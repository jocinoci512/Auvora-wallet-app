import type { RequestHandler } from 'express';
import { FixedWindowRateLimiter } from '@auvora/security';

export type GatewayRateLimitOptions = {
  limit: number;
  windowSeconds: number;
  /** Paths that skip rate limiting (health/docs). */
  skipPaths?: string[];
};

export function createGatewayRateLimitMiddleware(
  options: GatewayRateLimitOptions,
): RequestHandler {
  const limiter = new FixedWindowRateLimiter(options.limit, options.windowSeconds * 1000);
  const skip = new Set(
    options.skipPaths ?? ['/health', '/ready', '/api/docs', '/api/docs-json', '/metrics/resilience'],
  );

  return (req, res, next) => {
    const path = req.path || '/';
    if ([...skip].some((p) => path === p || path.startsWith(`${p}/`))) {
      next();
      return;
    }
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : undefined) ||
      req.socket.remoteAddress ||
      'unknown';
    const key = `${ip}:${req.method}:${path.split('/').slice(0, 4).join('/')}`;
    const result = limiter.consume(key);
    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
    if (!result.allowed) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
      });
      return;
    }
    next();
  };
}
