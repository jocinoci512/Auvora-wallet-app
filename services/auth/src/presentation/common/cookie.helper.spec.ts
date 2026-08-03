import type { Response } from 'express';
import { ACCESS_TOKEN_COOKIE, CSRF_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@auvora/security';
import {
  clearAuthCookies,
  setAccessTokenCookie,
  setCsrfTokenCookie,
  setRefreshTokenCookie,
} from './cookie.helper';

function mockRes(): Response & { cookie: jest.Mock; clearCookie: jest.Mock } {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  } as never;
}

const prodEnv = {
  COOKIE_SECURE: true,
  COOKIE_DOMAIN: undefined,
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 604800,
} as never;

const localEnv = {
  COOKIE_SECURE: false,
  COOKIE_DOMAIN: '',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 604800,
} as never;

describe('cookie.helper', () => {
  it('sets Secure host-only cookies in production (no Domain)', () => {
    const res = mockRes();
    setRefreshTokenCookie(res, prodEnv, 'refresh');
    setAccessTokenCookie(res, prodEnv, 'access');
    setCsrfTokenCookie(res, prodEnv, 'csrf');

    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh',
      expect.objectContaining({
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        domain: undefined,
      }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      'access',
      expect.objectContaining({ secure: true, httpOnly: true, domain: undefined }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      CSRF_TOKEN_COOKIE,
      'csrf',
      expect.objectContaining({ secure: true, httpOnly: false, domain: undefined }),
    );
  });

  it('allows non-Secure cookies on localhost development', () => {
    const res = mockRes();
    setRefreshTokenCookie(res, localEnv, 'refresh');
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh',
      expect.objectContaining({ secure: false, domain: undefined }),
    );
  });

  it('omits Domain when COOKIE_DOMAIN is localhost', () => {
    const res = mockRes();
    setRefreshTokenCookie(res, { ...localEnv, COOKIE_DOMAIN: 'localhost' } as never, 'refresh');
    expect(res.cookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      'refresh',
      expect.objectContaining({ domain: undefined }),
    );
  });

  it('clears auth cookies with matching options', () => {
    const res = mockRes();
    clearAuthCookies(res, prodEnv);
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ secure: true, maxAge: 0 }),
    );
  });
});
