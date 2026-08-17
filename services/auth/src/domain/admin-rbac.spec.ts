import {
  ADMIN_CONTROL_PLANE_PERMISSIONS,
  ADMIN_ROLE_CAPABILITIES,
  MFA_REQUIRED_ROLES,
  READ_ONLY_ADMIN_PERMISSIONS,
  ROLE_ADMIN,
  ROLE_READ_ONLY,
  ROLE_SECURITY_ANALYST,
  ROLE_SUPER_ADMIN,
  ROLE_SUPPORT,
  adminSessionPermissions,
} from './permission-codes';
import { ADMIN_PORTAL_ROLES, isAdminPortalRole } from '@auvora/types';

const caps = (role: string): readonly string[] => ADMIN_ROLE_CAPABILITIES[role] ?? [];
const has = (role: string, perm: string): boolean => caps(role).includes(perm as never);

// Any permission that can change state. No read-only role may hold these.
const MUTATING = [
  'users:write',
  'users:suspend',
  'users:reactivate',
  'sessions:revoke',
  'devices:revoke',
  'connections:revoke',
  'security:manage',
  'support:write',
  'admins:manage',
  'roles:manage',
];

// Wallet custody / signing must never be grantable to any admin role.
const CUSTODY = ['custody:sign', 'custody:approve', 'wallets:write', 'wallets:admin'];

describe('admin RBAC capability matrix', () => {
  it('defines exactly the five admin roles', () => {
    expect(Object.keys(ADMIN_ROLE_CAPABILITIES).sort()).toEqual(
      [ROLE_READ_ONLY, ROLE_SUPPORT, ROLE_SECURITY_ANALYST, ROLE_ADMIN, ROLE_SUPER_ADMIN].sort(),
    );
  });

  it('production Admin portal access is SUPER_ADMIN only', () => {
    expect([...ADMIN_PORTAL_ROLES]).toEqual([ROLE_SUPER_ADMIN]);
    expect(isAdminPortalRole(ROLE_SUPER_ADMIN)).toBe(true);
    expect(isAdminPortalRole(ROLE_ADMIN)).toBe(false);
    expect(isAdminPortalRole(ROLE_SUPPORT)).toBe(false);
    expect(isAdminPortalRole(ROLE_SECURITY_ANALYST)).toBe(false);
    expect(isAdminPortalRole(ROLE_READ_ONLY)).toBe(false);
  });

  it('READ_ONLY holds only read permissions (no mutations, ever)', () => {
    for (const perm of MUTATING) expect(has(ROLE_READ_ONLY, perm)).toBe(false);
    // Everything read_only has is in the read floor.
    for (const perm of caps(ROLE_READ_ONLY)) {
      expect(READ_ONLY_ADMIN_PERMISSIONS).toContain(perm as never);
    }
  });

  it('SUPPORT can assist but cannot manage roles/admins/security or revoke', () => {
    expect(has(ROLE_SUPPORT, 'users:write')).toBe(true);
    expect(has(ROLE_SUPPORT, 'support:write')).toBe(true);
    expect(has(ROLE_SUPPORT, 'roles:manage')).toBe(false);
    expect(has(ROLE_SUPPORT, 'admins:manage')).toBe(false);
    expect(has(ROLE_SUPPORT, 'security:manage')).toBe(false);
    expect(has(ROLE_SUPPORT, 'sessions:revoke')).toBe(false);
    expect(has(ROLE_SUPPORT, 'users:suspend')).toBe(false);
  });

  it('SECURITY_ANALYST can act on security but not manage roles/admins', () => {
    expect(has(ROLE_SECURITY_ANALYST, 'security:manage')).toBe(true);
    expect(has(ROLE_SECURITY_ANALYST, 'sessions:revoke')).toBe(true);
    expect(has(ROLE_SECURITY_ANALYST, 'devices:revoke')).toBe(true);
    expect(has(ROLE_SECURITY_ANALYST, 'connections:revoke')).toBe(true);
    expect(has(ROLE_SECURITY_ANALYST, 'roles:manage')).toBe(false);
    expect(has(ROLE_SECURITY_ANALYST, 'admins:manage')).toBe(false);
    expect(has(ROLE_SECURITY_ANALYST, 'users:write')).toBe(false);
  });

  it('ADMIN administers users/security but cannot manage admins or roles (reserved to SUPER_ADMIN)', () => {
    expect(has(ROLE_ADMIN, 'users:suspend')).toBe(true);
    expect(has(ROLE_ADMIN, 'users:reactivate')).toBe(true);
    expect(has(ROLE_ADMIN, 'sessions:revoke')).toBe(true);
    expect(has(ROLE_ADMIN, 'security:manage')).toBe(true);
    expect(has(ROLE_ADMIN, 'admins:manage')).toBe(false);
    expect(has(ROLE_ADMIN, 'roles:manage')).toBe(false);
  });

  it('SUPER_ADMIN is a strict superset of ADMIN plus admins:manage and roles:manage', () => {
    for (const perm of caps(ROLE_ADMIN)) {
      expect(has(ROLE_SUPER_ADMIN, perm)).toBe(true);
    }
    expect(has(ROLE_SUPER_ADMIN, 'admins:manage')).toBe(true);
    expect(has(ROLE_SUPER_ADMIN, 'roles:manage')).toBe(true);
  });

  it('no admin role — including SUPER_ADMIN — can custody or sign user funds', () => {
    for (const role of Object.keys(ADMIN_ROLE_CAPABILITIES)) {
      for (const custody of CUSTODY) {
        expect(has(role, custody)).toBe(false);
      }
    }
  });

  it('every capability is a declared control-plane permission', () => {
    for (const role of Object.keys(ADMIN_ROLE_CAPABILITIES)) {
      for (const perm of caps(role)) {
        expect(ADMIN_CONTROL_PLANE_PERMISSIONS).toContain(perm as never);
      }
    }
  });

  it('requires MFA for super_admin, admin, and security_analyst', () => {
    expect(MFA_REQUIRED_ROLES).toEqual(
      expect.arrayContaining([ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_SECURITY_ANALYST]),
    );
    expect(MFA_REQUIRED_ROLES).not.toContain(ROLE_READ_ONLY);
    expect(MFA_REQUIRED_ROLES).not.toContain(ROLE_SUPPORT);
  });

  it('strips custody and wallet-admin grants from Admin session permissions', () => {
    const filtered = adminSessionPermissions(
      [ROLE_SUPER_ADMIN],
      [...caps(ROLE_SUPER_ADMIN), 'custody:sign', 'wallets:admin', 'wallets:write'],
    );
    expect(filtered).not.toContain('custody:sign');
    expect(filtered).not.toContain('wallets:admin');
    expect(filtered).not.toContain('wallets:write');
    expect(filtered).toEqual([...caps(ROLE_SUPER_ADMIN)]);
  });
});
