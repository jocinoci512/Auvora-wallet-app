-- Vault device-to-device recovery + acceptance audit actions
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VAULT_RECOVERY_REQUESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VAULT_RECOVERY_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VAULT_RECOVERY_DENIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VAULT_RECOVERY_COMPLETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VAULT_RECOVERY_EXPIRED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCEPTANCE_EMAIL_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCEPTANCE_USER_CLEANUP';

CREATE TYPE "VaultDeviceRecoveryStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'CONSUMED');

CREATE TABLE "vault_device_recovery_requests" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "requesting_device_fingerprint" TEXT NOT NULL,
    "requesting_platform" TEXT,
    "requesting_public_key" TEXT NOT NULL,
    "ownership_token_hash" TEXT NOT NULL,
    "status" "VaultDeviceRecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "approved_by_device_id" UUID,
    "denied_at" TIMESTAMP(3),
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_device_recovery_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vault_device_recovery_payloads" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "ephemeral_public_key" TEXT NOT NULL,
    "aad" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_device_recovery_payloads_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vault_device_recovery_requests_owner_user_id_status_idx" ON "vault_device_recovery_requests"("owner_user_id", "status");
CREATE INDEX "vault_device_recovery_requests_expires_at_idx" ON "vault_device_recovery_requests"("expires_at");
CREATE INDEX "vault_device_recovery_requests_ownership_token_hash_idx" ON "vault_device_recovery_requests"("ownership_token_hash");

CREATE UNIQUE INDEX "vault_device_recovery_payloads_request_id_key" ON "vault_device_recovery_payloads"("request_id");

ALTER TABLE "vault_device_recovery_requests" ADD CONSTRAINT "vault_device_recovery_requests_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vault_device_recovery_payloads" ADD CONSTRAINT "vault_device_recovery_payloads_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "vault_device_recovery_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
