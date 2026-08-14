import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RATE_LIMITER, type RateLimiterPort } from '../../application/ports/clock.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { ConnectionsRateLimitError } from '../../domain/errors';

/**
 * Redis-backed service-level rate limit for connections HTTP traffic.
 *
 * - Skips liveness/readiness probes and internal mesh routes
 *   (`/api/v1/internal/*`, authenticated by the shared internal API key).
 * - Keys by authenticated user id when present, otherwise client IP + path, so
 *   it composes with (does not replace) the gateway edge rate limit.
 * - Soft-fails open on Redis errors so a cache blip never denies legitimate
 *   gateway traffic.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    // Explicit token keeps `Reflector` a value import (DI metadata) and satisfies
    // @typescript-eslint/consistent-type-imports.
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: { sub?: string } }>();
    const path = request.path ?? request.url ?? '';
    if (
      path === '/health' ||
      path === '/ready' ||
      path.startsWith('/health/') ||
      path.startsWith('/api/v1/internal/')
    ) {
      return true;
    }

    const userId = request.user?.sub;
    const ip =
      (typeof request.ip === 'string' && request.ip) ||
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      'unknown';
    const key = userId
      ? `connections:rl:u:${userId}`
      : `connections:rl:ip:${ip}:${path.split('?')[0]}`;

    try {
      const result = await this.rateLimiter.consume(
        key,
        this.env.CONNECTIONS_RATE_LIMIT_MAX,
        this.env.CONNECTIONS_RATE_LIMIT_WINDOW_SECONDS,
      );
      if (!result.allowed) {
        throw new ConnectionsRateLimitError('Too many requests');
      }
    } catch (error) {
      if (error instanceof ConnectionsRateLimitError) {
        throw error;
      }
      // Soft-fail: a Redis blip must not deny legitimate gateway traffic.
      return true;
    }
    return true;
  }
}
