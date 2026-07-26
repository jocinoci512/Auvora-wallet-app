-- CreateEnum
CREATE TYPE "CustodyModel" AS ENUM ('SELF', 'HOSTED', 'SHARED', 'INSTITUTIONAL', 'MPC', 'HSM');

-- CreateEnum
CREATE TYPE "KeyAlgorithm" AS ENUM ('SECP256K1', 'ED25519', 'BITCOIN_SECP256K1', 'ETHEREUM_SECP256K1', 'FUTURE_PQ');

-- CreateEnum
CREATE TYPE "KeyStatus" AS ENUM ('PENDING', 'ACTIVE', 'ROTATING', 'REVOKED', 'DESTROYED', 'RECOVERING');

-- CreateEnum
CREATE TYPE "SigningRequestStatus" AS ENUM ('PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'QUEUED', 'SCHEDULED', 'SIGNING', 'SIGNED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SigningRequestType" AS ENUM ('TRANSACTION', 'MESSAGE', 'BATCH', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ApprovalPolicyKind" AS ENUM ('SINGLE', 'DUAL', 'MULTI', 'THRESHOLD', 'RISK_BASED', 'AMOUNT_BASED', 'ROLE_BASED', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecoveryRequestStatus" AS ENUM ('PENDING', 'AWAITING_APPROVAL', 'APPROVED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustodyPolicyAction" AS ENUM ('ALLOW', 'DENY', 'REQUIRE_APPROVAL', 'DELAY', 'ALERT');

-- CreateTable
CREATE TABLE "custody_providers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custody_model" "CustodyModel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "config" JSONB,
    "health_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "last_checked_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "custody_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cryptographic_keys" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "wallet_id" UUID,
    "provider_id" UUID,
    "label" TEXT,
    "algorithm" "KeyAlgorithm" NOT NULL,
    "custody_model" "CustodyModel" NOT NULL,
    "status" "KeyStatus" NOT NULL DEFAULT 'PENDING',
    "public_key" TEXT NOT NULL,
    "material_encrypted" TEXT,
    "provider_ref" TEXT,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "export_allowed" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "destroyed_at" TIMESTAMP(3),
    CONSTRAINT "cryptographic_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_versions" (
    "id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "public_key" TEXT NOT NULL,
    "material_encrypted" TEXT,
    "provider_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotated_from_version" INTEGER,
    CONSTRAINT "key_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_audit_logs" (
    "id" UUID NOT NULL,
    "key_id" UUID,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "key_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signer_groups" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "total_signers" INTEGER NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "signer_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signer_group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SIGNER',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "signer_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" "ApprovalPolicyKind" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "amount_threshold" TEXT,
    "risk_threshold" INTEGER,
    "required_roles" JSONB,
    "signer_group_id" UUID,
    "expression" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_policies" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required_approvals" INTEGER NOT NULL DEFAULT 1,
    "timeout_hours" INTEGER NOT NULL DEFAULT 72,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recovery_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_contacts" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "email_encrypted" TEXT,
    "phone_encrypted" TEXT,
    "user_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_requests" (
    "id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "key_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "status" "RecoveryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "approvals_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "recovery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_transaction_policies" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "action" "CustodyPolicyAction" NOT NULL,
    "expression" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "custody_transaction_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_requests" (
    "id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "request_type" "SigningRequestType" NOT NULL,
    "status" "SigningRequestStatus" NOT NULL DEFAULT 'PENDING',
    "payload_hash" TEXT NOT NULL,
    "payload_encrypted" TEXT,
    "amount" TEXT,
    "asset" TEXT,
    "destination" TEXT,
    "risk_score" INTEGER,
    "approval_policy_id" UUID,
    "required_approvals" INTEGER NOT NULL DEFAULT 0,
    "received_approvals" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "delay_until" TIMESTAMP(3),
    "signature" TEXT,
    "signature_alg" TEXT,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "signing_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signing_sessions" (
    "id" UUID NOT NULL,
    "signing_request_id" UUID NOT NULL,
    "provider_code" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "latency_ms" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "metadata" JSONB,
    CONSTRAINT "signing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL,
    "signing_request_id" UUID NOT NULL,
    "policy_id" UUID,
    "approver_user_id" UUID,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decision_note" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_audit_records" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "subject_user_id" UUID,
    "resource_type" TEXT,
    "resource_id" UUID,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custody_audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_event_logs" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" UUID,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custody_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custody_policy_violations" (
    "id" UUID NOT NULL,
    "policy_code" TEXT NOT NULL,
    "owner_user_id" UUID,
    "signing_request_id" UUID,
    "action" "CustodyPolicyAction" NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "custody_policy_violations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custody_providers_code_key" ON "custody_providers"("code");
CREATE INDEX "custody_providers_is_enabled_priority_idx" ON "custody_providers"("is_enabled", "priority");
CREATE INDEX "custody_providers_custody_model_idx" ON "custody_providers"("custody_model");
CREATE INDEX "cryptographic_keys_owner_user_id_status_idx" ON "cryptographic_keys"("owner_user_id", "status");
CREATE INDEX "cryptographic_keys_wallet_id_idx" ON "cryptographic_keys"("wallet_id");
CREATE INDEX "cryptographic_keys_provider_id_idx" ON "cryptographic_keys"("provider_id");
CREATE INDEX "cryptographic_keys_status_created_at_idx" ON "cryptographic_keys"("status", "created_at");
CREATE UNIQUE INDEX "key_versions_key_id_version_key" ON "key_versions"("key_id", "version");
CREATE INDEX "key_versions_key_id_created_at_idx" ON "key_versions"("key_id", "created_at");
CREATE INDEX "key_audit_logs_key_id_created_at_idx" ON "key_audit_logs"("key_id", "created_at");
CREATE INDEX "key_audit_logs_action_created_at_idx" ON "key_audit_logs"("action", "created_at");
CREATE INDEX "key_audit_logs_actor_user_id_created_at_idx" ON "key_audit_logs"("actor_user_id", "created_at");
CREATE INDEX "signer_groups_owner_user_id_idx" ON "signer_groups"("owner_user_id");
CREATE INDEX "signer_groups_is_enabled_idx" ON "signer_groups"("is_enabled");
CREATE UNIQUE INDEX "signer_group_members_group_id_user_id_key" ON "signer_group_members"("group_id", "user_id");
CREATE INDEX "signer_group_members_user_id_idx" ON "signer_group_members"("user_id");
CREATE UNIQUE INDEX "approval_policies_code_key" ON "approval_policies"("code");
CREATE INDEX "approval_policies_is_enabled_kind_idx" ON "approval_policies"("is_enabled", "kind");
CREATE UNIQUE INDEX "recovery_policies_code_key" ON "recovery_policies"("code");
CREATE INDEX "recovery_policies_owner_user_id_is_enabled_idx" ON "recovery_policies"("owner_user_id", "is_enabled");
CREATE INDEX "recovery_contacts_policy_id_idx" ON "recovery_contacts"("policy_id");
CREATE INDEX "recovery_contacts_owner_user_id_idx" ON "recovery_contacts"("owner_user_id");
CREATE INDEX "recovery_requests_owner_user_id_status_idx" ON "recovery_requests"("owner_user_id", "status");
CREATE INDEX "recovery_requests_status_created_at_idx" ON "recovery_requests"("status", "created_at");
CREATE UNIQUE INDEX "custody_transaction_policies_code_key" ON "custody_transaction_policies"("code");
CREATE INDEX "custody_transaction_policies_is_enabled_priority_idx" ON "custody_transaction_policies"("is_enabled", "priority");
CREATE INDEX "signing_requests_owner_user_id_status_idx" ON "signing_requests"("owner_user_id", "status");
CREATE INDEX "signing_requests_key_id_created_at_idx" ON "signing_requests"("key_id", "created_at");
CREATE INDEX "signing_requests_status_created_at_idx" ON "signing_requests"("status", "created_at");
CREATE INDEX "signing_requests_scheduled_at_idx" ON "signing_requests"("scheduled_at");
CREATE INDEX "signing_sessions_signing_request_id_idx" ON "signing_sessions"("signing_request_id");
CREATE INDEX "signing_sessions_started_at_idx" ON "signing_sessions"("started_at");
CREATE INDEX "approval_requests_signing_request_id_status_idx" ON "approval_requests"("signing_request_id", "status");
CREATE INDEX "approval_requests_approver_user_id_status_idx" ON "approval_requests"("approver_user_id", "status");
CREATE INDEX "custody_audit_records_action_created_at_idx" ON "custody_audit_records"("action", "created_at");
CREATE INDEX "custody_audit_records_subject_user_id_created_at_idx" ON "custody_audit_records"("subject_user_id", "created_at");
CREATE INDEX "custody_audit_records_resource_type_resource_id_idx" ON "custody_audit_records"("resource_type", "resource_id");
CREATE INDEX "custody_event_logs_event_type_created_at_idx" ON "custody_event_logs"("event_type", "created_at");
CREATE INDEX "custody_event_logs_aggregate_id_created_at_idx" ON "custody_event_logs"("aggregate_id", "created_at");
CREATE INDEX "custody_policy_violations_policy_code_created_at_idx" ON "custody_policy_violations"("policy_code", "created_at");
CREATE INDEX "custody_policy_violations_owner_user_id_created_at_idx" ON "custody_policy_violations"("owner_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "cryptographic_keys" ADD CONSTRAINT "cryptographic_keys_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "custody_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "key_versions" ADD CONSTRAINT "key_versions_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "cryptographic_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "key_audit_logs" ADD CONSTRAINT "key_audit_logs_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "cryptographic_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signer_group_members" ADD CONSTRAINT "signer_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "signer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_policies" ADD CONSTRAINT "approval_policies_signer_group_id_fkey" FOREIGN KEY ("signer_group_id") REFERENCES "signer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "recovery_contacts" ADD CONSTRAINT "recovery_contacts_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "recovery_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "recovery_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "recovery_requests" ADD CONSTRAINT "recovery_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "cryptographic_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "cryptographic_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "signing_requests" ADD CONSTRAINT "signing_requests_approval_policy_id_fkey" FOREIGN KEY ("approval_policy_id") REFERENCES "approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "signing_sessions" ADD CONSTRAINT "signing_sessions_signing_request_id_fkey" FOREIGN KEY ("signing_request_id") REFERENCES "signing_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_signing_request_id_fkey" FOREIGN KEY ("signing_request_id") REFERENCES "signing_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
