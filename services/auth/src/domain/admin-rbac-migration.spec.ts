import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION = join(
  __dirname,
  '../../../../database/prisma/migrations/20260816020000_admin_rbac_roles/migration.sql',
);

describe('admin RBAC migration', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('adds the three new production roles', () => {
    for (const role of ["'support'", "'security_analyst'", "'read_only'"]) {
      expect(sql).toContain(role);
    }
  });

  it('adds the granular admin permission codes', () => {
    for (const code of [
      'users:suspend',
      'sessions:read',
      'devices:revoke',
      'connections:revoke',
      'security:manage',
      'support:write',
      'admins:manage',
      'roles:read',
      'health:read',
      'realtime:read',
    ]) {
      expect(sql).toContain(code);
    }
  });

  it('is additive and idempotent (no destructive statements)', () => {
    expect(sql).toContain('ON CONFLICT');
    expect(sql.toUpperCase()).not.toMatch(/\bDELETE\b/);
    expect(sql.toUpperCase()).not.toMatch(/\bDROP\b/);
    expect(sql.toUpperCase()).not.toMatch(/\bTRUNCATE\b/);
    expect(sql.toUpperCase()).not.toMatch(/\bUPDATE\b/);
    // Never inserts users or writes password material.
    expect(sql.toLowerCase()).not.toContain('insert into "users"');
    expect(sql.toLowerCase()).not.toContain('password_hash');
  });

  it('does not grant custody/signing to any role', () => {
    expect(sql).not.toContain('custody:sign');
    expect(sql).not.toContain('wallets:admin');
  });
});
