import type { AdminOperator } from './admin-session';
import { ADMIN_ROLE_PERMISSIONS, hasPermission } from './admin-rbac';

function operator(roles: string[]): AdminOperator {
  return {
    id: 'op',
    email: 'owner@auvora.test',
    username: 'owner',
    firstName: null,
    lastName: null,
    status: 'ACTIVE',
    mfaEnabled: true,
    mfaEnrolled: true,
    roles,
    lastLoginAt: null,
    activeSessionCount: 1,
    createdAt: new Date().toISOString(),
  };
}

describe('admin client RBAC convenience matrix', () => {
  it('grants SUPER_ADMIN the operational control-plane reads', () => {
    const op = operator(['super_admin']);
    for (const permission of [
      'users:read',
      'wallets:read',
      'connections:read',
      'audit:read',
      'health:read',
      'realtime:read',
      'admins:read',
      'blockchain:read',
      'simulation:read',
      'transactions:review:large',
      'security:read',
    ]) {
      expect(hasPermission(op, permission)).toBe(true);
    }
  });

  it('never grants custody or wallet write codes on any role', () => {
    for (const role of Object.keys(ADMIN_ROLE_PERMISSIONS)) {
      const perms = ADMIN_ROLE_PERMISSIONS[role] ?? [];
      expect(perms).not.toContain('custody:sign');
      expect(perms).not.toContain('wallets:write');
      expect(perms).not.toContain('wallets:admin');
    }
  });

  it('does not treat a customer role as admin-capable', () => {
    const customer = operator(['user']);
    expect(hasPermission(customer, 'users:read')).toBe(false);
    expect(hasPermission(customer, 'admins:manage')).toBe(false);
  });
});
