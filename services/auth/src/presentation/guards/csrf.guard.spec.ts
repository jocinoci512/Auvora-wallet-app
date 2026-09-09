import type { Reflector } from '@nestjs/core';
import { ForbiddenError } from '../../domain';
import { CsrfGuard } from './csrf.guard';

function context(request: object) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('CsrfGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(false),
  };
  const guard = new CsrfGuard(reflector as unknown as Reflector);

  it('allows GET without CSRF (SSE-safe)', () => {
    expect(
      guard.canActivate(context({ method: 'GET', path: '/api/v1/admin/realtime/events' })),
    ).toBe(true);
  });

  it('accepts a valid admin CSRF pair', () => {
    expect(
      guard.canActivate(
        context({
          method: 'POST',
          path: '/api/v1/auth/admin/logout',
          cookies: { admin_csrf_token: 'abc12345abc12345abc12345abc12345' },
          headers: { 'x-csrf-token': 'abc12345abc12345abc12345abc12345' },
        }),
      ),
    ).toBe(true);
  });

  it('rejects missing CSRF on admin mutations', () => {
    expect(() =>
      guard.canActivate(
        context({
          method: 'POST',
          path: '/api/v1/admin/operators/1/status',
          cookies: {},
          headers: {},
        }),
      ),
    ).toThrow(ForbiddenError);
  });

  it('rejects invalid CSRF on admin mutations with CSRF_FAILED', () => {
    try {
      guard.canActivate(
        context({
          method: 'POST',
          path: '/api/v1/admin/operators/1/status',
          cookies: { admin_csrf_token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
          headers: { 'x-csrf-token': 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' },
        }),
      );
      throw new Error('expected CSRF rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).code).toBe('CSRF_FAILED');
    }
  });
});
