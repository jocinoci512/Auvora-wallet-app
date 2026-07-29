-- Phase 22 — Staking & Yield Platform

CREATE TYPE "StakingPositionStatus" AS ENUM ('ACTIVE', 'UNSTAKING', 'CLOSED');
CREATE TYPE "StakingOperationType" AS ENUM ('STAKE', 'UNSTAKE', 'CLAIM');
CREATE TYPE "StakingOperationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMING', 'COMPLETED', 'FAILED');
CREATE TYPE "StakingRewardStatus" AS ENUM ('PENDING', 'CLAIMABLE', 'CLAIMED');
CREATE TYPE "StakingSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "StakingRetryJobStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE "staking_validators" (
    "id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "validator_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "commission_percent" DOUBLE PRECISION NOT NULL,
    "apy_percent" DOUBLE PRECISION NOT NULL,
    "uptime_percent" DOUBLE PRECISION NOT NULL,
    "total_delegated" TEXT NOT NULL,
    "delegator_count" INTEGER NOT NULL,
    "performance_score" DOUBLE PRECISION NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staking_validators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staking_positions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "asset_symbol" TEXT NOT NULL,
    "validator_id" TEXT NOT NULL,
    "staked_amount" TEXT NOT NULL,
    "pending_rewards" TEXT NOT NULL DEFAULT '0',
    "accumulated_rewards" TEXT NOT NULL DEFAULT '0',
    "apy_percent" DOUBLE PRECISION NOT NULL,
    "status" "StakingPositionStatus" NOT NULL DEFAULT 'ACTIVE',
    "user_address" TEXT NOT NULL,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staking_positions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staking_operations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "operation_type" "StakingOperationType" NOT NULL,
    "status" "StakingOperationStatus" NOT NULL DEFAULT 'PENDING',
    "asset_symbol" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "validator_id" TEXT NOT NULL,
    "user_address" TEXT NOT NULL,
    "position_id" UUID,
    "provider_code" TEXT NOT NULL,
    "provider_ref" TEXT,
    "prepared_tx" JSONB,
    "estimated_completion_seconds" INTEGER NOT NULL DEFAULT 0,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "tx_hash" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staking_operations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staking_rewards" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "asset_symbol" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "status" "StakingRewardStatus" NOT NULL DEFAULT 'PENDING',
    "claimed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staking_rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staking_provider_health" (
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
    CONSTRAINT "staking_provider_health_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staking_sync_jobs" (
    "id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" "StakingSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staking_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staking_retry_jobs" (
    "id" UUID NOT NULL,
    "operation_id" UUID,
    "job_type" TEXT NOT NULL,
    "status" "StakingRetryJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "staking_retry_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staking_validators_network_validator_id_key" ON "staking_validators"("network", "validator_id");
CREATE INDEX "staking_validators_network_performance_score_idx" ON "staking_validators"("network", "performance_score");
CREATE INDEX "staking_positions_user_id_status_idx" ON "staking_positions"("user_id", "status");
CREATE INDEX "staking_positions_network_validator_id_idx" ON "staking_positions"("network", "validator_id");
CREATE INDEX "staking_operations_user_id_status_idx" ON "staking_operations"("user_id", "status");
CREATE INDEX "staking_operations_status_created_at_idx" ON "staking_operations"("status", "created_at");
CREATE INDEX "staking_rewards_user_id_created_at_idx" ON "staking_rewards"("user_id", "created_at");
CREATE INDEX "staking_rewards_position_id_status_idx" ON "staking_rewards"("position_id", "status");
CREATE UNIQUE INDEX "staking_provider_health_code_key" ON "staking_provider_health"("code");
CREATE INDEX "staking_sync_jobs_status_created_at_idx" ON "staking_sync_jobs"("status", "created_at");
CREATE INDEX "staking_retry_jobs_status_created_at_idx" ON "staking_retry_jobs"("status", "created_at");

ALTER TABLE "staking_operations" ADD CONSTRAINT "staking_operations_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "staking_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staking_rewards" ADD CONSTRAINT "staking_rewards_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "staking_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
