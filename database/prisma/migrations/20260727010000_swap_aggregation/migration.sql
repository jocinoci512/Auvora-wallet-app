-- CreateEnum
CREATE TYPE "SwapExecutionStatus" AS ENUM ('PENDING', 'PREPARING', 'AWAITING_SIGNATURE', 'SUBMITTED', 'CONFIRMING', 'COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SwapRetryJobStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateTable
CREATE TABLE "swap_quote_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "provider_code" TEXT NOT NULL,
    "provider_quote_id" TEXT NOT NULL,
    "sell_token" TEXT NOT NULL,
    "buy_token" TEXT NOT NULL,
    "sell_amount" DECIMAL(36,18) NOT NULL,
    "amount_out" DECIMAL(36,18) NOT NULL,
    "min_amount_out" DECIMAL(36,18) NOT NULL,
    "slippage_bps" INTEGER NOT NULL,
    "price_impact_bps" INTEGER NOT NULL,
    "estimated_gas" TEXT NOT NULL,
    "estimated_fee_native" TEXT NOT NULL,
    "fee_amount" TEXT NOT NULL,
    "fee_asset" TEXT NOT NULL,
    "route_summary" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "latency_ms" INTEGER,
    "raw_quote" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swap_quote_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swap_route_snapshots" (
    "id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "provider_code" TEXT NOT NULL,
    "route_id" TEXT NOT NULL,
    "amount_out" DECIMAL(36,18) NOT NULL,
    "price_impact_bps" INTEGER NOT NULL,
    "hops" JSONB NOT NULL,
    "is_best" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swap_route_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swap_executions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "quote_id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "provider_code" TEXT NOT NULL,
    "provider_ref" TEXT NOT NULL,
    "status" "SwapExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "sell_token" TEXT NOT NULL,
    "buy_token" TEXT NOT NULL,
    "sell_amount" DECIMAL(36,18) NOT NULL,
    "expected_amount_out" DECIMAL(36,18) NOT NULL,
    "min_amount_out" DECIMAL(36,18) NOT NULL,
    "actual_amount_out" DECIMAL(36,18),
    "price_impact_bps" INTEGER,
    "fee_paid" TEXT,
    "user_address" TEXT,
    "prepared_tx" JSONB,
    "tx_hash" TEXT,
    "confirmations" INTEGER DEFAULT 0,
    "error_message" TEXT,
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swap_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swap_receipts" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "sell_token" TEXT NOT NULL,
    "buy_token" TEXT NOT NULL,
    "sell_amount" DECIMAL(36,18) NOT NULL,
    "amount_out" DECIMAL(36,18) NOT NULL,
    "provider_code" TEXT NOT NULL,
    "fee_paid" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swap_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swap_provider_health" (
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

    CONSTRAINT "swap_provider_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "swap_retry_jobs" (
    "id" UUID NOT NULL,
    "execution_id" UUID,
    "job_type" TEXT NOT NULL,
    "status" "SwapRetryJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swap_retry_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swap_quote_records_user_id_created_at_idx" ON "swap_quote_records"("user_id", "created_at");
CREATE INDEX "swap_quote_records_network_created_at_idx" ON "swap_quote_records"("network", "created_at");
CREATE INDEX "swap_route_snapshots_quote_id_idx" ON "swap_route_snapshots"("quote_id");
CREATE INDEX "swap_route_snapshots_provider_code_created_at_idx" ON "swap_route_snapshots"("provider_code", "created_at");
CREATE INDEX "swap_executions_user_id_created_at_idx" ON "swap_executions"("user_id", "created_at");
CREATE INDEX "swap_executions_status_created_at_idx" ON "swap_executions"("status", "created_at");
CREATE INDEX "swap_executions_tx_hash_idx" ON "swap_executions"("tx_hash");
CREATE UNIQUE INDEX "swap_receipts_execution_id_key" ON "swap_receipts"("execution_id");
CREATE INDEX "swap_receipts_user_id_created_at_idx" ON "swap_receipts"("user_id", "created_at");
CREATE UNIQUE INDEX "swap_provider_health_code_key" ON "swap_provider_health"("code");
CREATE INDEX "swap_retry_jobs_status_created_at_idx" ON "swap_retry_jobs"("status", "created_at");

-- AddForeignKey
ALTER TABLE "swap_route_snapshots" ADD CONSTRAINT "swap_route_snapshots_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "swap_quote_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "swap_executions" ADD CONSTRAINT "swap_executions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "swap_quote_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "swap_receipts" ADD CONSTRAINT "swap_receipts_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "swap_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
