-- Phase 3 final: Admin MFA / session surface / audit actions.
-- Additive only: new enum values, new columns with defaults, new tables.
-- Never deletes users, roles, grants, or existing sessions.

-- 1) New audit actions. Values are not written here — application code emits them
-- after deploy. IF NOT EXISTS keeps this idempotent on PostgreSQL 9.1+ / 15+.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_LOGIN_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_MFA_ENROLLED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_MFA_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_MFA_RECOVERY_USED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_MFA_RESET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_STEP_UP_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_STEP_UP_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ADMIN_SESSION_REVOKED';

-- 2) Session surface + step-up / MFA timestamps (existing rows stay consumer).
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "surface" TEXT NOT NULL DEFAULT 'consumer';
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "mfa_satisfied_at" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "step_up_expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "sessions_user_id_surface_revoked_at_idx"
  ON "sessions" ("user_id", "surface", "revoked_at");

-- 3) TOTP credentials — encrypted secret at rest, never a plaintext column.
CREATE TABLE IF NOT EXISTS "mfa_totp_credentials" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "secret_encrypted" TEXT NOT NULL,
  "confirmed_at" TIMESTAMP(3),
  "last_used_step" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "mfa_totp_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "mfa_totp_credentials_user_id_key"
  ON "mfa_totp_credentials" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mfa_totp_credentials_user_id_fkey'
  ) THEN
    ALTER TABLE "mfa_totp_credentials"
      ADD CONSTRAINT "mfa_totp_credentials_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) Recovery codes — hashes only.
CREATE TABLE IF NOT EXISTS "mfa_recovery_codes" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "code_hash" TEXT NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "mfa_recovery_codes_user_id_idx"
  ON "mfa_recovery_codes" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mfa_recovery_codes_user_id_fkey'
  ) THEN
    ALTER TABLE "mfa_recovery_codes"
      ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
