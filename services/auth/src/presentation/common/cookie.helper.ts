import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
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
  return {
    secure: env.COOKIE_SECURE,
    domain: env.COOKIE_DOMAIN,
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

export function getRefreshTokenFromRequest(cookies: Record<string, string | undefined>): string | undefined {
  return cookies[REFRESH_TOKEN_COOKIE];
}
