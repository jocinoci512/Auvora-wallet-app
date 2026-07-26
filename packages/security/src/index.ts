import { createHash, randomBytes } from 'node:crypto';

export const SECURITY_HEADERS = {
  contentTypeOptions: 'nosniff',
  frameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  xssProtection: '0',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-site',
} as const;

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const CSRF_TOKEN_COOKIE = 'csrf_token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function assertNonEmptySecret(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required secret: ${name}`);
  }
  return value;
}

export function redactSensitive(value: string, visible = 4): string {
  if (value.length <= visible * 2) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, visible)}${'*'.repeat(Math.max(4, value.length - visible * 2))}${value.slice(-visible)}`;
}

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
};

/** In-memory fixed-window rate limiter (gateway edge / local fallback). */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string): RateLimitResult {
    const now = Date.now();
    const existing = this.windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + this.windowMs;
      this.windows.set(key, { count: 1, resetAt });
      return { allowed: true, remaining: this.limit - 1, limit: this.limit, resetAt };
    }
    existing.count += 1;
    const allowed = existing.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - existing.count),
      limit: this.limit,
      resetAt: existing.resetAt,
    };
  }

  size(): number {
    return this.windows.size;
  }
}
