-- Admin simulation controls + persistent large-transfer review queue.
-- Additive only: new enums, new tables, new indexes, new admin permissions.

-- CreateEnum
CREATE TYPE "LargeTransferReviewStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

-- CreateEnum
CREATE TYPE "SimulationAccountStatus" AS ENUM (
  'ACTIVE',
  'DISABLED'
);

-- CreateEnum
CREATE TYPE "SimulationBalanceEventType" AS ENUM (
  'ACCOUNT_ENABLED',
  'ACCOUNT_DISABLED',
  'ASSET_ADDED',
  'BALANCE_SET',
  'BALANCE_INCREASED',
  'BALANCE_DECREASED',
  'ASSET_REMOVED',
  'PORTFOLIO_RESET',
  'PRESET_APPLIED'
);

-- CreateEnum
CREATE TYPE "SimulationTransactionStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'SECURITY_HOLD',
  'PENDING_REVIEW'
);

-- Extend audit action enum for TEST-account and review operations.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEST_ACCOUNT_CLASSIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TEST_ACCOUNT_UNCLASSIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIMULATION_BALANCE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIMULATION_PORTFOLIO_RESET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SIMULATION_PRESET_APPLIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LARGE_TRANSFER_REVIEW_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LARGE_TRANSFER_REVIEW_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LARGE_TRANSFER_REVIEW_REJECTED';

-- CreateTable
CREATE TABLE "large_transfer_reviews" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "wallet_id" UUID,
  "asset_id" UUID NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" UUID,
  "network" TEXT NOT NULL,
  "from_address" TEXT,
  "destination_address" TEXT NOT NULL,
  "amount" DECIMAL(36,18) NOT NULL,
  "amount_usd_cents" BIGINT NOT NULL DEFAULT 0,
  "price_usd_cents_per_whole" BIGINT,
  "price_timestamp" TIMESTAMP(3),
  "status" "LargeTransferReviewStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_user_id" UUID,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decision_by_user_id" UUID,
  "decision_at" TIMESTAMP(3),
  "decision_reason" TEXT,
  "rejection_reason" TEXT,
  "expires_at" TIMESTAMP(3),
  "metadata" JSONB,

  CONSTRAINT "large_transfer_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_accounts" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "status" "SimulationAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by_user_id" UUID,
  "updated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "simulation_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_balances" (
  "id" UUID NOT NULL,
  "simulation_account_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "quantity" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "simulation_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_balance_events" (
  "id" UUID NOT NULL,
  "simulation_account_id" UUID NOT NULL,
  "simulation_balance_id" UUID,
  "asset_id" UUID,
  "event_type" "SimulationBalanceEventType" NOT NULL,
  "previous_quantity" DECIMAL(36,18),
  "new_quantity" DECIMAL(36,18),
  "delta_quantity" DECIMAL(36,18),
  "valuation_usd" DECIMAL(20,2),
  "reason" TEXT NOT NULL,
  "admin_user_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "simulation_balance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_transactions" (
  "id" UUID NOT NULL,
  "simulation_account_id" UUID NOT NULL,
  "simulation_balance_id" UUID,
  "asset_id" UUID NOT NULL,
  "wallet_id" UUID,
  "reference" TEXT NOT NULL,
  "status" "SimulationTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "direction" TEXT NOT NULL,
  "amount" DECIMAL(36,18) NOT NULL,
  "fee_amount" DECIMAL(36,18) NOT NULL DEFAULT 0,
  "destination_address" TEXT,
  "note" TEXT,
  "review_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "simulation_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "large_transfer_reviews_owner_user_id_status_requested_at_idx"
  ON "large_transfer_reviews"("owner_user_id", "status", "requested_at");
CREATE INDEX "large_transfer_reviews_wallet_id_requested_at_idx"
  ON "large_transfer_reviews"("wallet_id", "requested_at");
CREATE UNIQUE INDEX "large_transfer_reviews_source_type_source_id_key"
  ON "large_transfer_reviews"("source_type", "source_id");
CREATE INDEX "large_transfer_reviews_status_requested_at_idx"
  ON "large_transfer_reviews"("status", "requested_at");

CREATE UNIQUE INDEX "simulation_accounts_owner_user_id_key"
  ON "simulation_accounts"("owner_user_id");
CREATE INDEX "simulation_accounts_status_created_at_idx"
  ON "simulation_accounts"("status", "created_at");

CREATE UNIQUE INDEX "simulation_balances_simulation_account_id_asset_id_key"
  ON "simulation_balances"("simulation_account_id", "asset_id");
CREATE INDEX "simulation_balances_simulation_account_id_updated_at_idx"
  ON "simulation_balances"("simulation_account_id", "updated_at");

CREATE INDEX "simulation_balance_events_simulation_account_id_created_at_idx"
  ON "simulation_balance_events"("simulation_account_id", "created_at");
CREATE INDEX "simulation_balance_events_admin_user_id_created_at_idx"
  ON "simulation_balance_events"("admin_user_id", "created_at");

CREATE UNIQUE INDEX "simulation_transactions_reference_key"
  ON "simulation_transactions"("reference");
CREATE UNIQUE INDEX "simulation_transactions_review_id_key"
  ON "simulation_transactions"("review_id");
CREATE INDEX "simulation_transactions_simulation_account_id_created_at_idx"
  ON "simulation_transactions"("simulation_account_id", "created_at");
CREATE INDEX "simulation_transactions_status_created_at_idx"
  ON "simulation_transactions"("status", "created_at");

-- AddForeignKey
ALTER TABLE "large_transfer_reviews"
  ADD CONSTRAINT "large_transfer_reviews_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "large_transfer_reviews"
  ADD CONSTRAINT "large_transfer_reviews_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "simulation_balances"
  ADD CONSTRAINT "simulation_balances_simulation_account_id_fkey"
  FOREIGN KEY ("simulation_account_id") REFERENCES "simulation_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "simulation_balances"
  ADD CONSTRAINT "simulation_balances_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "simulation_balance_events"
  ADD CONSTRAINT "simulation_balance_events_simulation_account_id_fkey"
  FOREIGN KEY ("simulation_account_id") REFERENCES "simulation_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "simulation_balance_events"
  ADD CONSTRAINT "simulation_balance_events_simulation_balance_id_fkey"
  FOREIGN KEY ("simulation_balance_id") REFERENCES "simulation_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "simulation_balance_events"
  ADD CONSTRAINT "simulation_balance_events_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "simulation_transactions"
  ADD CONSTRAINT "simulation_transactions_simulation_account_id_fkey"
  FOREIGN KEY ("simulation_account_id") REFERENCES "simulation_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "simulation_transactions"
  ADD CONSTRAINT "simulation_transactions_simulation_balance_id_fkey"
  FOREIGN KEY ("simulation_balance_id") REFERENCES "simulation_balances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "simulation_transactions"
  ADD CONSTRAINT "simulation_transactions_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "simulation_transactions"
  ADD CONSTRAINT "simulation_transactions_wallet_id_fkey"
  FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "simulation_transactions"
  ADD CONSTRAINT "simulation_transactions_review_id_fkey"
  FOREIGN KEY ("review_id") REFERENCES "large_transfer_reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- New permissions for staff access to the large-transfer queue and simulation controls.
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'transactions:review:large', 'Review high-value wallet transfers', now(), now()),
  (gen_random_uuid(), 'simulation:read', 'Read TEST-account simulation balances and history', now(), now()),
  (gen_random_uuid(), 'simulation:manage', 'Manage TEST-account simulation balances and scenarios', now(), now())
ON CONFLICT ("code") DO NOTHING;

-- Admin + super_admin receive queue + simulation management.
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."code" IN ('transactions:review:large', 'simulation:read', 'simulation:manage')
WHERE r."name" IN ('admin', 'super_admin')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- Support + security_analyst can read simulation state for investigations.
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
JOIN "permissions" p ON p."code" = 'simulation:read'
WHERE r."name" IN ('support', 'security_analyst')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
