-- Phase 24 — Cross-Chain Bridge & Asset Transfer

CREATE TYPE "BridgeTransferStatus" AS ENUM ('PENDING_CONFIRMATION', 'SUBMITTED', 'BRIDGING', 'COMPLETED', 'FAILED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "BridgeSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "BridgeRetryJobStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'CANCELLED');

CREATE TABLE "bridge_quotes" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "provider_quote_id" TEXT NOT NULL,
    "source_network" "ChainNetwork" NOT NULL,
    "destination_network" "ChainNetwork" NOT NULL,
    "asset_symbol" TEXT NOT NULL,
    "amount_in" TEXT NOT NULL,
    "amount_out" TEXT NOT NULL,
    "min_amount_out" TEXT NOT NULL,
    "fee_amount" TEXT NOT NULL,
    "fee_asset" TEXT NOT NULL,
    "estimated_fee_native" TEXT NOT NULL,
    "estimated_completion_seconds" INTEGER NOT NULL,
    "route_summary" TEXT NOT NULL,
    "route_json" JSONB NOT NULL,
    "replay_nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bridge_quotes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bridge_quotes_replay_nonce_key" ON "bridge_quotes"("replay_nonce");
CREATE INDEX "bridge_quotes_user_id_created_at_idx" ON "bridge_quotes"("user_id", "created_at");

CREATE TABLE "bridge_transfers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "quote_id" UUID,
    "provider_code" TEXT NOT NULL,
    "provider_quote_id" TEXT NOT NULL,
    "provider_ref" TEXT,
    "status" "BridgeTransferStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "source_network" "ChainNetwork" NOT NULL,
    "destination_network" "ChainNetwork" NOT NULL,
    "asset_symbol" TEXT NOT NULL,
    "amount_in" TEXT NOT NULL,
    "amount_out_expected" TEXT NOT NULL,
    "amount_out_actual" TEXT,
    "fee_amount" TEXT NOT NULL,
    "fee_asset" TEXT NOT NULL,
    "estimated_completion_seconds" INTEGER NOT NULL,
    "route_summary" TEXT NOT NULL,
    "prepared_tx" JSONB,
    "requires_confirmation" BOOLEAN NOT NULL DEFAULT true,
    "replay_nonce" TEXT NOT NULL,
    "source_address" TEXT,
    "destination_address" TEXT,
    "source_tx_hash" TEXT,
    "destination_tx_hash" TEXT,
    "error_message" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bridge_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bridge_transfers_user_id_status_idx" ON "bridge_transfers"("user_id", "status");
CREATE INDEX "bridge_transfers_provider_ref_idx" ON "bridge_transfers"("provider_ref");

CREATE TABLE "bridge_receipts" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "source_network" "ChainNetwork" NOT NULL,
    "destination_network" "ChainNetwork" NOT NULL,
    "asset_symbol" TEXT NOT NULL,
    "amount_in" TEXT NOT NULL,
    "amount_out" TEXT NOT NULL,
    "source_tx_hash" TEXT,
    "destination_tx_hash" TEXT,
    "status" TEXT NOT NULL,
    "payload_encrypted" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bridge_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bridge_receipts_transfer_id_key" ON "bridge_receipts"("transfer_id");
CREATE INDEX "bridge_receipts_user_id_created_at_idx" ON "bridge_receipts"("user_id", "created_at");

CREATE TABLE "bridge_route_catalog" (
    "id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "source_network" "ChainNetwork" NOT NULL,
    "destination_network" "ChainNetwork" NOT NULL,
    "asset_symbol" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "estimated_fee_native" TEXT NOT NULL,
    "estimated_completion_seconds" INTEGER NOT NULL,
    "hops" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bridge_route_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bridge_route_catalog_provider_code_route_id_key" ON "bridge_route_catalog"("provider_code", "route_id");
CREATE INDEX "bridge_route_catalog_source_network_destination_network_idx" ON "bridge_route_catalog"("source_network", "destination_network");

CREATE TABLE "bridge_provider_health" (
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
    CONSTRAINT "bridge_provider_health_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bridge_provider_health_code_key" ON "bridge_provider_health"("code");

CREATE TABLE "bridge_sync_jobs" (
    "id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "BridgeSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bridge_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bridge_sync_jobs_status_created_at_idx" ON "bridge_sync_jobs"("status", "created_at");

CREATE TABLE "bridge_retry_jobs" (
    "id" UUID NOT NULL,
    "transfer_id" UUID,
    "job_type" TEXT NOT NULL,
    "status" "BridgeRetryJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bridge_retry_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bridge_retry_jobs_status_created_at_idx" ON "bridge_retry_jobs"("status", "created_at");

ALTER TABLE "bridge_transfers" ADD CONSTRAINT "bridge_transfers_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "bridge_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bridge_receipts" ADD CONSTRAINT "bridge_receipts_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "bridge_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
