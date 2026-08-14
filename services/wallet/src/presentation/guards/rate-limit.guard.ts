import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '@auvora/nest-common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { RateLimitError } from '../../domain';
import { RATE_LIMITER, type RateLimiterPort } from '../../application/ports/clock.port';

/**
 * Global Redis-backed rate limit for wallet HTTP traffic.
 * Skips liveness/readiness and uses IP + path buckets.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(RATE_LIMITER) private readonly rateLimiter: RateLimiterPort,
    // Explicit token keeps `Reflector` a value import (required for DI metadata)
    // and satisfies @typescript-eslint/consistent-type-imports.
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path ?? request.url ?? '';
    if (path === '/health' || path === '/ready' || path.startsWith('/health/')) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Public health already skipped; other public routes (if any) still rate-limited.
    void isPublic;

    const ip =
      (typeof request.ip === 'string' && request.ip) ||
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      'unknown';
    const key = `wallet:${ip}:${request.method}:${path.split('?')[0]}`;
    try {
      const result = await this.rateLimiter.consume(
        key,
        this.env.RATE_LIMIT_MAX,
        this.env.RATE_LIMIT_WINDOW_SECONDS,
      );
      if (!result.allowed) {
        throw new RateLimitError('Too many requests');
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      // Soft-fail: Redis blips must not take down authenticated wallet traffic.
      return true;
    }
    return true;
  }
}
