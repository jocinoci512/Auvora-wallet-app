import { createHash, randomBytes } from 'node:crypto';

export {
  assertCredentialedCorsAllowlist,
  createCredentialedCorsOriginDelegate,
  isAllowedCorsOrigin,
  isLocalDevOrigin,
  normalizeCorsOriginEntry,
  parseCorsOrigins,
  resolveCredentialedCorsOrigins,
  type AssertCorsAllowlistOptions,
  type CorsOriginDelegate,
} from './cors-origins';

export const SECURITY_HEADERS = {
  contentTypeOptions: 'nosniff',
  frameOptions: 'DENY',
  referrerPolicy: 'no-referrer',
  permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  xssProtection: '0',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-site',
} as const;

/**
 * Recommended baseline CSP for GA / edge termination (not enforced in RC1).
 * Gateway + Next emit this as Content-Security-Policy-Report-Only in RC1.
 * Promote to enforced CSP at the ingress after validating NFT media, Swagger, and analytics.
 * `script-src` may need `'unsafe-inline'` for Next.js until nonces are wired.
 */
export const CONTENT_SECURITY_POLICY_RECOMMENDED =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https: wss:;";

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const CSRF_TOKEN_COOKIE = 'csrf_token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

/** Isolated Admin cookie family — never reuse consumer cookie names. */
export const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token';
export const ADMIN_ACCESS_TOKEN_COOKIE = 'admin_access_token';
export const ADMIN_CSRF_TOKEN_COOKIE = 'admin_csrf_token';

export function extractAccessTokenFromCookies(
  cookies: Record<string, unknown> | undefined,
): string | null {
  if (!cookies) {
    return null;
  }
  const admin = cookies[ADMIN_ACCESS_TOKEN_COOKIE];
  if (typeof admin === 'string' && admin.length > 0) {
    return admin;
  }
  const access = cookies[ACCESS_TOKEN_COOKIE];
  if (typeof access === 'string' && access.length > 0) {
    return access;
  }
  return null;
}

export function isAdminApiPath(pathname: string | undefined): boolean {
  if (!pathname) {
    return false;
  }
  return pathname.startsWith('/api/v1/admin') || pathname.startsWith('/api/v1/auth/admin');
}

export function extractCsrfCookie(
  cookies: Record<string, unknown> | undefined,
  pathname: string | undefined,
): string | undefined {
  if (!cookies) {
    return undefined;
  }
  if (isAdminApiPath(pathname)) {
    const admin = cookies[ADMIN_CSRF_TOKEN_COOKIE];
    return typeof admin === 'string' ? admin : undefined;
  }
  const consumer = cookies[CSRF_TOKEN_COOKIE];
  return typeof consumer === 'string' ? consumer : undefined;
}

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
