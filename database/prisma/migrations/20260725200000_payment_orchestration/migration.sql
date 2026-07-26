-- Phase 5: Payment Orchestration & Settlement

CREATE TYPE "PaymentType" AS ENUM (
  'FIAT_DEPOSIT',
  'FIAT_WITHDRAWAL',
  'CRYPTO_DEPOSIT',
  'CRYPTO_WITHDRAWAL',
  'INTERNAL_TRANSFER',
  'WALLET_TRANSFER',
  'MERCHANT_PAYMENT',
  'SCHEDULED_PAYMENT',
  'RECURRING_PAYMENT',
  'PAYMENT_REQUEST',
  'REFUND',
  'REVERSAL',
  'SETTLEMENT'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'CREATED',
  'PENDING',
  'AUTHORIZED',
  'PROCESSING',
  'SETTLED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'REVERSED',
  'DISPUTED',
  'CHARGEBACK'
);

CREATE TYPE "PaymentMethodType" AS ENUM (
  'BANK_ACCOUNT',
  'CARD',
  'WALLET',
  'CRYPTO_ADDRESS',
  'MERCHANT',
  'OTHER'
);

CREATE TYPE "SettlementMode" AS ENUM ('INSTANT', 'DAILY', 'SCHEDULED', 'MANUAL');

CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

CREATE TYPE "ReconciliationStatus" AS ENUM (
  'PENDING',
  'MATCHED',
  'MISMATCH',
  'EXCEPTION',
  'MANUAL_REVIEW',
  'RESOLVED'
);

CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'WON', 'LOST', 'CLOSED');

CREATE TYPE "ChargebackStatus" AS ENUM ('OPEN', 'ACCEPTED', 'DEFENDED', 'WON', 'LOST', 'CLOSED');

CREATE TYPE "LimitWindow" AS ENUM ('PER_TRANSACTION', 'DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "payment_providers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "capabilities" JSONB,
    "endpoint_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_providers_code_key" ON "payment_providers"("code");
CREATE INDEX "payment_providers_is_enabled_priority_idx" ON "payment_providers"("is_enabled", "priority");

CREATE TABLE "payment_methods" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "label" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last4" TEXT,
    "country" TEXT,
    "currency" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_methods_owner_user_id_is_active_idx" ON "payment_methods"("owner_user_id", "is_active");

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "owner_user_id" UUID NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "fee_amount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "asset_code" TEXT,
    "from_wallet_id" UUID,
    "to_wallet_id" UUID,
    "payment_method_id" UUID,
    "provider_id" UUID,
    "provider_ref" TEXT,
    "idempotency_key" TEXT,
    "correlation_id" TEXT,
    "wallet_transaction_id" UUID,
    "chain_tx_id" UUID,
    "country" TEXT,
    "account_tier" TEXT,
    "risk_profile" TEXT,
    "risk_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "failure_reason" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "authorized_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
CREATE INDEX "payments_owner_user_id_status_created_at_idx" ON "payments"("owner_user_id", "status", "created_at");
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE INDEX "payments_provider_ref_idx" ON "payments"("provider_ref");
CREATE INDEX "payments_correlation_id_idx" ON "payments"("correlation_id");
CREATE INDEX "payments_type_status_idx" ON "payments"("type", "status");

CREATE TABLE "settlement_batches" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "mode" "SettlementMode" NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL,
    "total_amount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "payment_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "report" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "settlement_batches_reference_key" ON "settlement_batches"("reference");
CREATE INDEX "settlement_batches_status_scheduled_at_idx" ON "settlement_batches"("status", "scheduled_at");
CREATE INDEX "settlement_batches_mode_created_at_idx" ON "settlement_batches"("mode", "created_at");

CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "batch_id" UUID,
    "payment_id" UUID NOT NULL,
    "mode" "SettlementMode" NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(36,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "audit_trail" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "settlements_reference_key" ON "settlements"("reference");
CREATE INDEX "settlements_batch_id_idx" ON "settlements"("batch_id");
CREATE INDEX "settlements_payment_id_idx" ON "settlements"("payment_id");
CREATE INDEX "settlements_status_created_at_idx" ON "settlements"("status", "created_at");

CREATE TABLE "payment_limits" (
    "id" UUID NOT NULL,
    "window" "LimitWindow" NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "currency" TEXT,
    "asset_code" TEXT,
    "owner_user_id" UUID,
    "account_tier" TEXT,
    "country" TEXT,
    "risk_profile" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_limits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_limits_owner_user_id_window_is_enabled_idx" ON "payment_limits"("owner_user_id", "window", "is_enabled");
CREATE INDEX "payment_limits_account_tier_window_idx" ON "payment_limits"("account_tier", "window");
CREATE INDEX "payment_limits_country_window_idx" ON "payment_limits"("country", "window");
CREATE INDEX "payment_limits_risk_profile_window_idx" ON "payment_limits"("risk_profile", "window");

CREATE TABLE "reconciliation_records" (
    "id" UUID NOT NULL,
    "payment_id" UUID,
    "settlement_id" UUID,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL,
    "expected_amount" DECIMAL(36,18),
    "actual_amount" DECIMAL(36,18),
    "currency" TEXT,
    "mismatch_reason" TEXT,
    "requires_manual_review" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reconciliation_records_status_created_at_idx" ON "reconciliation_records"("status", "created_at");
CREATE INDEX "reconciliation_records_payment_id_idx" ON "reconciliation_records"("payment_id");
CREATE INDEX "reconciliation_records_requires_manual_review_status_idx" ON "reconciliation_records"("requires_manual_review", "status");

CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "reason" TEXT,
    "provider_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "refunds_payment_id_created_at_idx" ON "refunds"("payment_id", "created_at");
CREATE INDEX "refunds_status_created_at_idx" ON "refunds"("status", "created_at");

CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "amount" DECIMAL(36,18),
    "currency" TEXT,
    "metadata" JSONB,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "disputes_payment_id_idx" ON "disputes"("payment_id");
CREATE INDEX "disputes_status_opened_at_idx" ON "disputes"("status", "opened_at");

CREATE TABLE "chargebacks" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "status" "ChargebackStatus" NOT NULL DEFAULT 'OPEN',
    "amount" DECIMAL(36,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "provider_ref" TEXT,
    "metadata" JSONB,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chargebacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "chargebacks_payment_id_idx" ON "chargebacks"("payment_id");
CREATE INDEX "chargebacks_status_opened_at_idx" ON "chargebacks"("status", "opened_at");

CREATE TABLE "payment_event_logs" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" UUID,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_event_logs_event_type_created_at_idx" ON "payment_event_logs"("event_type", "created_at");
CREATE INDEX "payment_event_logs_aggregate_id_created_at_idx" ON "payment_event_logs"("aggregate_id", "created_at");

CREATE TABLE "payment_provider_health_snapshots" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "provider_code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "error_message" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_provider_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_provider_health_snapshots_provider_code_checked_at_idx" ON "payment_provider_health_snapshots"("provider_code", "checked_at");
CREATE INDEX "payment_provider_health_snapshots_provider_id_checked_at_idx" ON "payment_provider_health_snapshots"("provider_id", "checked_at");

ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reconciliation_records" ADD CONSTRAINT "reconciliation_records_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "chargebacks" ADD CONSTRAINT "chargebacks_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_provider_health_snapshots" ADD CONSTRAINT "payment_provider_health_snapshots_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "payment_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
