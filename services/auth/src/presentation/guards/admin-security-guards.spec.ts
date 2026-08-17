import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { RolesGuard, StepUpGuard } from '@auvora/nest-common';

function context(user: object | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('Admin security guards', () => {
  it('denies a consumer-surface token on Admin portal roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['super_admin', 'admin', 'support']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    expect(() =>
      guard.canActivate(
        context({
          sub: 'user-1',
          roles: ['super_admin'],
          surface: 'consumer',
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('denies non-SUPER_ADMIN roles on owner-only portal endpoints', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['super_admin']),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);
    for (const role of ['admin', 'support', 'security_analyst', 'read_only', 'user']) {
      expect(() =>
        guard.canActivate(
          context({
            sub: 'staff-1',
            roles: [role],
            surface: 'admin',
          }),
        ),
      ).toThrow(ForbiddenException);
    }
    expect(
      guard.canActivate(
        context({
          sub: 'owner-1',
          roles: ['super_admin'],
          surface: 'admin',
        }),
      ),
    ).toBe(true);
  });

  it('30. high-risk action requires a live step-up window', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new StepUpGuard(reflector as unknown as Reflector);
    expect(() =>
      guard.canActivate(
        context({
          sub: 'admin-1',
          roles: ['super_admin'],
          surface: 'admin',
          stepUpExp: Math.floor(Date.now() / 1000) - 1,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('31. valid step-up window is accepted', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new StepUpGuard(reflector as unknown as Reflector);
    expect(
      guard.canActivate(
        context({
          sub: 'admin-1',
          roles: ['super_admin'],
          surface: 'admin',
          stepUpExp: Math.floor(Date.now() / 1000) + 600,
        }),
      ),
    ).toBe(true);
  });

  it('32. expired step-up is denied', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) };
    const guard = new StepUpGuard(reflector as unknown as Reflector);
    expect(() =>
      guard.canActivate(
        context({
          sub: 'admin-1',
          roles: ['super_admin'],
          surface: 'admin',
        }),
      ),
    ).toThrow(/Step-up/);
  });
});
