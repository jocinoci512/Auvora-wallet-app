import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_CSRF_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@auvora/security';
import type { ServiceEnv } from '../../config/env.schema';

export interface CookieOptions {
  secure: boolean;
  domain?: string;
  sameSite: 'lax' | 'strict' | 'none';
  httpOnly: boolean;
  path: string;
  maxAge?: number;
}

function baseCookieOptions(env: ServiceEnv): CookieOptions {
  // Prefer host-only cookies (omit Domain): auth cookies are set/read by the API host
  // (gateway/auth). Cross-subdomain Domain cookies are only needed if web and API must
  // share the cookie jar — not required for credentials:include to api.* from apex.
  // Empty / "localhost" Domain breaks cookies in many browsers — omit Domain.
  const domain =
    env.COOKIE_DOMAIN &&
    env.COOKIE_DOMAIN.trim() !== '' &&
    env.COOKIE_DOMAIN.trim().toLowerCase() !== 'localhost'
      ? env.COOKIE_DOMAIN.trim()
      : undefined;
  return {
    secure: env.COOKIE_SECURE,
    domain,
    sameSite: 'lax',
    httpOnly: true,
    path: '/',
  };
}

export function setRefreshTokenCookie(res: Response, env: ServiceEnv, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions(env),
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
  });
}

export function setCsrfTokenCookie(res: Response, env: ServiceEnv, token: string): void {
  res.cookie(CSRF_TOKEN_COOKIE, token, {
    ...baseCookieOptions(env),
    httpOnly: false,
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
  });
}

export function setAccessTokenCookie(res: Response, env: ServiceEnv, token: string): void {
  res.cookie(ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions(env),
    maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response, env: ServiceEnv): void {
  const opts = { ...baseCookieOptions(env), maxAge: 0 };
  res.clearCookie(REFRESH_TOKEN_COOKIE, opts);
  res.clearCookie(CSRF_TOKEN_COOKIE, { ...opts, httpOnly: false });
  res.clearCookie(ACCESS_TOKEN_COOKIE, opts);
}

export function getRefreshTokenFromRequest(
  cookies: Record<string, string | undefined>,
): string | undefined {
  return cookies[REFRESH_TOKEN_COOKIE];
}

export function setAdminRefreshTokenCookie(res: Response, env: ServiceEnv, token: string): void {
  res.cookie(ADMIN_REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions(env),
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
  });
}

export function setAdminAccessTokenCookie(res: Response, env: ServiceEnv, token: string): void {
  res.cookie(ADMIN_ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions(env),
    maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000,
  });
}

export function setAdminCsrfTokenCookie(res: Response, env: ServiceEnv, token: string): void {
  res.cookie(ADMIN_CSRF_TOKEN_COOKIE, token, {
    ...baseCookieOptions(env),
    httpOnly: false,
    maxAge: env.JWT_REFRESH_TTL_SECONDS * 1000,
  });
}

export function clearAdminAuthCookies(res: Response, env: ServiceEnv): void {
  const opts = { ...baseCookieOptions(env), maxAge: 0 };
  res.clearCookie(ADMIN_REFRESH_TOKEN_COOKIE, opts);
  res.clearCookie(ADMIN_ACCESS_TOKEN_COOKIE, opts);
  res.clearCookie(ADMIN_CSRF_TOKEN_COOKIE, { ...opts, httpOnly: false });
}

export function getAdminRefreshTokenFromRequest(
  cookies: Record<string, string | undefined>,
): string | undefined {
  return cookies[ADMIN_REFRESH_TOKEN_COOKIE];
}
