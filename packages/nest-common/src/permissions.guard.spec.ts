import { ForbiddenException } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';

function executionContext(user: { permissions: string[] } | undefined, required: string[]) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(required),
  };
  const guard = new PermissionsGuard(reflector as never);
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
  return { guard, context };
}

describe('PermissionsGuard', () => {
  it('denies staff without simulation:manage', () => {
    const { guard, context } = executionContext({ permissions: ['simulation:read'] }, [
      'simulation:manage',
    ]);
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('denies staff without transactions:review:large', () => {
    const { guard, context } = executionContext({ permissions: ['users:read'] }, [
      'transactions:review:large',
    ]);
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('denies staff without users:write', () => {
    const { guard, context } = executionContext({ permissions: ['users:read'] }, ['users:write']);
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('denies staff without audit:read', () => {
    const { guard, context } = executionContext({ permissions: ['users:read'] }, ['audit:read']);
    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it('allows SUPER_ADMIN-equivalent grants for the required permission', () => {
    const { guard, context } = executionContext(
      {
        permissions: [
          'simulation:manage',
          'transactions:review:large',
          'users:write',
          'audit:read',
        ],
      },
      ['simulation:manage'],
    );
    expect(guard.canActivate(context as never)).toBe(true);
  });
});
