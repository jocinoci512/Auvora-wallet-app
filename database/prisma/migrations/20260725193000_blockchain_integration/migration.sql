-- Phase 4 Blockchain Integration

CREATE TYPE "ChainAddressStatus" AS ENUM ('PENDING', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "ChainTxDirection" AS ENUM ('INCOMING', 'OUTGOING', 'INTERNAL');
CREATE TYPE "ChainTxStatus" AS ENUM ('MEMPOOL', 'PENDING', 'CONFIRMED', 'FAILED', 'REJECTED', 'CANCELLED', 'REORGED');
CREATE TYPE "SyncJobType" AS ENUM ('BLOCK_SCAN', 'ADDRESS_WATCH', 'MEMPOOL', 'REORG_CHECK', 'RETRY');
CREATE TYPE "SyncJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RETRYING', 'CANCELLED');
CREATE TYPE "FeePriority" AS ENUM ('SLOW', 'STANDARD', 'FAST', 'PRIORITY');

CREATE TABLE "blockchain_network_configs" (
    "id" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "required_confirmations" INTEGER NOT NULL,
    "block_time_seconds" INTEGER NOT NULL DEFAULT 15,
    "native_symbol" TEXT NOT NULL,
    "explorer_url" TEXT,
    "rpc_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "blockchain_network_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blockchain_network_configs_chain_key" ON "blockchain_network_configs"("chain");

CREATE TABLE "blockchain_providers" (
    "id" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "network_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "endpoint_url" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "blockchain_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "blockchain_providers_chain_code_key" ON "blockchain_providers"("chain", "code");
CREATE INDEX "blockchain_providers_network_id_is_enabled_idx" ON "blockchain_providers"("network_id", "is_enabled");

CREATE TABLE "chain_addresses" (
    "id" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "network_id" UUID NOT NULL,
    "wallet_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ChainAddressStatus" NOT NULL DEFAULT 'PENDING',
    "watched" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activated_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "chain_addresses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chain_addresses_chain_address_key" ON "chain_addresses"("chain", "address");
CREATE INDEX "chain_addresses_owner_user_id_chain_status_idx" ON "chain_addresses"("owner_user_id", "chain", "status");
CREATE INDEX "chain_addresses_wallet_id_idx" ON "chain_addresses"("wallet_id");
CREATE INDEX "chain_addresses_watched_status_idx" ON "chain_addresses"("watched", "status");

CREATE TABLE "chain_transactions" (
    "id" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "network_id" UUID NOT NULL,
    "address_id" UUID,
    "tx_hash" TEXT NOT NULL,
    "direction" "ChainTxDirection" NOT NULL,
    "status" "ChainTxStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(36,18) NOT NULL,
    "fee_amount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "from_address" TEXT,
    "to_address" TEXT,
    "block_number" BIGINT,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "required_confirmations" INTEGER NOT NULL,
    "broadcast_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "raw_payload" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chain_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chain_transactions_chain_tx_hash_key" ON "chain_transactions"("chain", "tx_hash");
CREATE INDEX "chain_transactions_status_created_at_idx" ON "chain_transactions"("status", "created_at");
CREATE INDEX "chain_transactions_address_id_created_at_idx" ON "chain_transactions"("address_id", "created_at");
CREATE INDEX "chain_transactions_network_id_block_number_idx" ON "chain_transactions"("network_id", "block_number");

CREATE TABLE "confirmation_records" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "address_id" UUID,
    "chain" "ChainNetwork" NOT NULL,
    "confirmations" INTEGER NOT NULL,
    "block_number" BIGINT,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "confirmation_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "confirmation_records_transaction_id_observed_at_idx" ON "confirmation_records"("transaction_id", "observed_at");
CREATE INDEX "confirmation_records_chain_observed_at_idx" ON "confirmation_records"("chain", "observed_at");

CREATE TABLE "chain_blocks" (
    "id" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "network_id" UUID NOT NULL,
    "height" BIGINT NOT NULL,
    "hash" TEXT NOT NULL,
    "parent_hash" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "is_orphan" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chain_blocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chain_blocks_chain_height_hash_key" ON "chain_blocks"("chain", "height", "hash");
CREATE INDEX "chain_blocks_network_id_height_idx" ON "chain_blocks"("network_id", "height");
CREATE INDEX "chain_blocks_chain_is_orphan_idx" ON "chain_blocks"("chain", "is_orphan");

CREATE TABLE "sync_jobs" (
    "id" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "network_id" UUID NOT NULL,
    "type" "SyncJobType" NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'QUEUED',
    "cursor" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sync_jobs_status_scheduled_at_idx" ON "sync_jobs"("status", "scheduled_at");
CREATE INDEX "sync_jobs_chain_type_status_idx" ON "sync_jobs"("chain", "type", "status");

CREATE TABLE "provider_health_snapshots" (
    "id" UUID NOT NULL,
    "chain" "ChainNetwork" NOT NULL,
    "network_id" UUID NOT NULL,
    "provider_id" UUID,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "block_height" BIGINT,
    "error_message" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "provider_health_snapshots_chain_checked_at_idx" ON "provider_health_snapshots"("chain", "checked_at");
CREATE INDEX "provider_health_snapshots_provider_id_checked_at_idx" ON "provider_health_snapshots"("provider_id", "checked_at");

CREATE TABLE "blockchain_event_logs" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "chain" "ChainNetwork",
    "aggregate_id" TEXT,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blockchain_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "blockchain_event_logs_event_type_created_at_idx" ON "blockchain_event_logs"("event_type", "created_at");
CREATE INDEX "blockchain_event_logs_chain_created_at_idx" ON "blockchain_event_logs"("chain", "created_at");

ALTER TABLE "blockchain_providers" ADD CONSTRAINT "blockchain_providers_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_network_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chain_addresses" ADD CONSTRAINT "chain_addresses_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_network_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chain_transactions" ADD CONSTRAINT "chain_transactions_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_network_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chain_transactions" ADD CONSTRAINT "chain_transactions_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "chain_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "confirmation_records" ADD CONSTRAINT "confirmation_records_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "chain_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "confirmation_records" ADD CONSTRAINT "confirmation_records_address_id_fkey" FOREIGN KEY ("address_id") REFERENCES "chain_addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "chain_blocks" ADD CONSTRAINT "chain_blocks_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_network_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_network_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_health_snapshots" ADD CONSTRAINT "provider_health_snapshots_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_network_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_health_snapshots" ADD CONSTRAINT "provider_health_snapshots_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "blockchain_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
