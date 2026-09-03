#!/usr/bin/env node
/**
 * LOCAL QA — safe user/auth diagnostics. Never prints password hashes or tokens.
 */
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });

function maskEmail(e) {
  if (!e || typeof e !== 'string') return null;
  const [u, d] = e.split('@');
  if (!d) return '***';
  return `${u.slice(0, 2)}***@${d}`;
}

async function main() {
  await client.connect();
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;

  // Prefer device-known email pattern from prior UI; also list recent users safely
  const byEmail = await q(
    `SELECT id,
            email::text AS email,
            username,
            status::text AS status,
            email_verified,
            (password_hash IS NOT NULL AND length(password_hash) > 0) AS has_password,
            failed_login_count,
            locked_until,
            last_login_at,
            created_at,
            updated_at,
            deleted_at
     FROM users
     WHERE deleted_at IS NULL
       AND (
         id = $1
         OR lower(email::text) LIKE $2
         OR lower(email::text) = $3
       )
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 10`,
    ['df1db712-5e50-42c1-92fc-2c7236244cf8', 'emmilianjoan%', 'qa@local'],
  );

  const recent = await q(
    `SELECT id, email::text AS email, status::text AS status, email_verified,
            (password_hash IS NOT NULL) AS has_password,
            failed_login_count, locked_until, last_login_at
     FROM users
     WHERE deleted_at IS NULL
     ORDER BY last_login_at DESC NULLS LAST
     LIMIT 8`,
  );

  const dupes = await q(
    `SELECT lower(email::text) AS email_norm, count(*)::int AS n
     FROM users WHERE deleted_at IS NULL
     GROUP BY 1 HAVING count(*) > 1`,
  );

  const out = {
    matchedUsers: byEmail.map((r) => ({
      idPrefix: String(r.id).slice(0, 8) + '…',
      idMatchCanonical: r.id === 'df1db712-5e50-42c1-92fc-2c7236244cf8',
      email: maskEmail(r.email),
      username: r.username ? String(r.username).slice(0, 4) + '…' : null,
      status: r.status,
      emailVerified: r.email_verified,
      passwordCredential: r.has_password ? 'PRESENT' : 'MISSING',
      failedLoginCount: r.failed_login_count,
      lockedUntil: r.locked_until,
      lockoutActive: r.locked_until ? new Date(r.locked_until) > new Date() : false,
      lastLoginAt: r.last_login_at,
      deleted: !!r.deleted_at,
    })),
    recentUsers: recent.map((r) => ({
      idPrefix: String(r.id).slice(0, 8) + '…',
      email: maskEmail(r.email),
      status: r.status,
      emailVerified: r.email_verified,
      passwordCredential: r.has_password ? 'PRESENT' : 'MISSING',
      failedLoginCount: r.failed_login_count,
      lockoutActive: r.locked_until ? new Date(r.locked_until) > new Date() : false,
      lastLoginAt: r.last_login_at,
    })),
    duplicateEmails: dupes,
  };

  // Login history for matched users (no secrets)
  if (byEmail[0]) {
    const hist = await q(
      `SELECT success, failure_reason, ip_address, user_agent, created_at
       FROM login_histories
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 8`,
      [byEmail[0].id],
    ).catch(async () => {
      // try alternate table name
      return q(
        `SELECT * FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%login%'`,
      );
    });
    out.recentLoginHistory = hist;
  }

  console.log(JSON.stringify(out, null, 2));
  await client.end();
}

main().catch((e) => {
  console.error('DB_DIAG_FAIL', e.message);
  process.exit(1);
});
