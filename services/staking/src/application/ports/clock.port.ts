export const CLOCK = Symbol('CLOCK');

export interface ClockPort {
  now(): Date;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export interface IdGeneratorPort {
  uuid(): string;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');

export interface RateLimiterPort {
  consume(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number }>;
}
