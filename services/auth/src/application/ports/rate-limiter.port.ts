export const RATE_LIMITER = Symbol('RATE_LIMITER');

export interface RateLimiterPort {
  consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }>;
}
