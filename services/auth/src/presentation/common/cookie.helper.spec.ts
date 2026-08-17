import type { Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  ADMIN_ACCESS_TOKEN_COOKIE,
  ADMIN_CSRF_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '@auvora/security';
import {
  clearAdminAuthCookies,
  clearAuthCookies,
  setAccessTokenCookie,
  setAdminAccessTokenCookie,
  setAdminCsrfTokenCookie,
  setAdminRefreshTokenCookie,
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

  it('sets isolated HttpOnly Secure Lax admin cookies and never consumer names', () => {
    const res = mockRes();
    setAdminRefreshTokenCookie(res, prodEnv, 'admin-refresh');
    setAdminAccessTokenCookie(res, prodEnv, 'admin-access');
    setAdminCsrfTokenCookie(res, prodEnv, 'admin-csrf');
    const names = res.cookie.mock.calls.map((call) => call[0]);
    expect(names).toEqual([
      ADMIN_REFRESH_TOKEN_COOKIE,
      ADMIN_ACCESS_TOKEN_COOKIE,
      ADMIN_CSRF_TOKEN_COOKIE,
    ]);
    expect(names).not.toContain(REFRESH_TOKEN_COOKIE);
    expect(names).not.toContain(ACCESS_TOKEN_COOKIE);
    expect(names).not.toContain(CSRF_TOKEN_COOKIE);
    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_ACCESS_TOKEN_COOKIE,
      'admin-access',
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      ADMIN_CSRF_TOKEN_COOKIE,
      'admin-csrf',
      expect.objectContaining({ httpOnly: false, secure: true, sameSite: 'lax' }),
    );
  });

  it('clears admin cookies on logout', () => {
    const res = mockRes();
    clearAdminAuthCookies(res, prodEnv);
    expect(res.clearCookie).toHaveBeenCalledWith(
      ADMIN_REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ maxAge: 0 }),
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      ADMIN_ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});
