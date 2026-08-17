import {
  ADMIN_ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE,
  extractAccessTokenFromCookies,
  extractCsrfCookie,
  isAdminApiPath,
} from './index';

describe('Admin cookie extractors', () => {
  it('prefers the isolated Admin access cookie over the consumer cookie', () => {
    expect(
      extractAccessTokenFromCookies({
        [ADMIN_ACCESS_TOKEN_COOKIE]: 'admin-jwt',
        [ACCESS_TOKEN_COOKIE]: 'consumer-jwt',
      }),
    ).toBe('admin-jwt');
  });

  it('returns null when no access cookie is present (unauthenticated SSE)', () => {
    expect(extractAccessTokenFromCookies({})).toBeNull();
  });

  it('uses the Admin CSRF cookie on Admin API paths', () => {
    expect(isAdminApiPath('/api/v1/admin/realtime/events')).toBe(true);
    expect(isAdminApiPath('/api/v1/auth/admin/login')).toBe(true);
    expect(
      extractCsrfCookie(
        { admin_csrf_token: 'admin-csrf', csrf_token: 'consumer-csrf' },
        '/api/v1/admin/operators',
      ),
    ).toBe('admin-csrf');
  });
});
