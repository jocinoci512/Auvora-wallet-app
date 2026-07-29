-- Phase 23 — Hardware Wallet & External Wallet Connectivity

CREATE TYPE "HardwareDeviceStatus" AS ENUM ('AVAILABLE', 'LOCKED', 'BUSY', 'DISCONNECTED', 'PAIRED', 'CONNECTED', 'ERROR', 'FIRMWARE_INCOMPATIBLE');
CREATE TYPE "WalletConnectSessionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'TERMINATED', 'EXPIRED');
CREATE TYPE "ExternalWalletKind" AS ENUM ('HARDWARE', 'WALLETCONNECT', 'BROWSER', 'READONLY');
CREATE TYPE "ExternalWalletConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR', 'REVOKED');
CREATE TYPE "WatchAddressStatus" AS ENUM ('ACTIVE', 'REMOVED');
CREATE TYPE "ExternalSigningRequestStatus" AS ENUM ('PENDING_CONFIRMATION', 'COMPLETED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ConnectionSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "ConnectionRetryJobStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'CANCELLED');

CREATE TABLE "hardware_devices" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "firmware_version" TEXT,
    "firmware_compatible" BOOLEAN NOT NULL DEFAULT true,
    "status" "HardwareDeviceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "accounts" JSONB,
    "paired_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "hardware_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hardware_devices_device_id_key" ON "hardware_devices"("device_id");
CREATE INDEX "hardware_devices_user_id_status_idx" ON "hardware_devices"("user_id", "status");

CREATE TABLE "walletconnect_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "proposal_id" TEXT,
    "topic" TEXT,
    "session_key" TEXT,
    "status" "WalletConnectSessionStatus" NOT NULL DEFAULT 'PENDING',
    "peer_name" TEXT,
    "peer_url" TEXT,
    "networks" JSONB,
    "permissions" JSONB,
    "accounts" JSONB,
    "encrypted_uri" TEXT,
    "qr_payload" TEXT,
    "deep_link" TEXT,
    "approved_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "last_restored_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "walletconnect_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "walletconnect_sessions_proposal_id_key" ON "walletconnect_sessions"("proposal_id");
CREATE UNIQUE INDEX "walletconnect_sessions_session_key_key" ON "walletconnect_sessions"("session_key");
CREATE INDEX "walletconnect_sessions_user_id_status_idx" ON "walletconnect_sessions"("user_id", "status");

CREATE TABLE "watch_addresses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "status" "WatchAddressStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "watch_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "watch_addresses_user_id_network_address_key" ON "watch_addresses"("user_id", "network", "address");
CREATE INDEX "watch_addresses_user_id_status_idx" ON "watch_addresses"("user_id", "status");

CREATE TABLE "external_wallet_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ExternalWalletKind" NOT NULL,
    "status" "ExternalWalletConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "provider_code" TEXT NOT NULL,
    "label" TEXT,
    "external_ref" TEXT,
    "can_sign" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_wallet_connections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "external_wallet_connections_user_id_kind_status_idx" ON "external_wallet_connections"("user_id", "kind", "status");
CREATE INDEX "external_wallet_connections_provider_code_idx" ON "external_wallet_connections"("provider_code");
CREATE INDEX "external_wallet_connections_external_ref_idx" ON "external_wallet_connections"("external_ref");

CREATE TABLE "external_signing_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "ExternalWalletKind" NOT NULL,
    "connection_ref" TEXT NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "payload_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "fee_estimate" TEXT,
    "provider_request_id" TEXT,
    "status" "ExternalSigningRequestStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "signature" TEXT,
    "tx_hash" TEXT,
    "error_message" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "external_signing_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "external_signing_requests_user_id_status_idx" ON "external_signing_requests"("user_id", "status");
CREATE INDEX "external_signing_requests_connection_ref_idx" ON "external_signing_requests"("connection_ref");

CREATE TABLE "connection_provider_health" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_success_at" TIMESTAMP(3),
    "last_failure_at" TIMESTAMP(3),
    "last_latency_ms" INTEGER,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connection_provider_health_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connection_provider_health_code_key" ON "connection_provider_health"("code");

CREATE TABLE "connection_sync_jobs" (
    "id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "ConnectionSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connection_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connection_sync_jobs_status_created_at_idx" ON "connection_sync_jobs"("status", "created_at");

CREATE TABLE "connection_retry_jobs" (
    "id" UUID NOT NULL,
    "operation_id" UUID,
    "job_type" TEXT NOT NULL,
    "status" "ConnectionRetryJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "connection_retry_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "connection_retry_jobs_status_created_at_idx" ON "connection_retry_jobs"("status", "created_at");
