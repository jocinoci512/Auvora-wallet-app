import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION = join(
  __dirname,
  '../../../../database/prisma/migrations/20260816180000_admin_mfa_sessions/migration.sql',
);

describe('admin MFA session migration', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('adds MFA tables and session surface columns', () => {
    expect(sql).toContain('mfa_totp_credentials');
    expect(sql).toContain('mfa_recovery_codes');
    expect(sql).toContain('secret_encrypted');
    expect(sql).toContain('code_hash');
    expect(sql).toContain('step_up_expires_at');
    expect(sql).toContain("'ADMIN_LOGIN_SUCCESS'");
  });

  it('does not insert users or password material', () => {
    expect(sql.toLowerCase()).not.toContain('insert into "users"');
    expect(sql.toLowerCase()).not.toContain('password_hash');
  });

  it('is additive', () => {
    expect(sql.toUpperCase()).not.toMatch(/\bTRUNCATE\b/);
    expect(sql.toLowerCase()).not.toContain('drop table');
  });
});
