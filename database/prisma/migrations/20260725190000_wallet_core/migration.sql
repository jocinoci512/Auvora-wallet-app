-- CreateEnum
CREATE TYPE "ChainNetwork" AS ENUM (
  'BITCOIN',
  'ETHEREUM',
  'POLYGON',
  'SOLANA',
  'BNB_SMART_CHAIN',
  'TRON',
  'LITECOIN'
);

-- CreateEnum
CREATE TYPE "AssetStandard" AS ENUM (
  'NATIVE',
  'ERC20',
  'TRC20',
  'BEP20',
  'SPL',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "WalletStatus" AS ENUM (
  'PENDING',
  'ACTIVE',
  'SUSPENDED',
  'ARCHIVED'
);

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM (
  'CREDIT',
  'DEBIT',
  'PENDING',
  'CONFIRMED',
  'FAILED',
  'REVERSED',
  'CANCELLED',
  'ADJUSTMENT',
  'CORRECTION'
);

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM (
  'INTERNAL_TRANSFER',
  'DEPOSIT',
  'WITHDRAWAL',
  'ADJUSTMENT'
);

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REVERSED'
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 8,
    "chain" "ChainNetwork" NOT NULL,
    "standard" "AssetStandard" NOT NULL DEFAULT 'NATIVE',
    "contract_address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "alias" TEXT,
    "label" TEXT,
    "status" "WalletStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "preferences" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "archived_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_balances" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "available" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "pending" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "locked" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "total" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "from_wallet_id" UUID,
    "to_wallet_id" UUID,
    "asset_id" UUID NOT NULL,
    "to_asset_id" UUID,
    "amount" DECIMAL(36,18) NOT NULL,
    "fee_amount" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "initiated_by" UUID,
    "failure_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "transaction_id" UUID,
    "entry_type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(36,18) NOT NULL,
    "balance_after_available" DECIMAL(36,18) NOT NULL,
    "balance_after_pending" DECIMAL(36,18) NOT NULL,
    "balance_after_locked" DECIMAL(36,18) NOT NULL,
    "balance_after_reserved" DECIMAL(36,18) NOT NULL,
    "balance_after_total" DECIMAL(36,18) NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshots" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "available" DECIMAL(36,18) NOT NULL,
    "pending" DECIMAL(36,18) NOT NULL,
    "locked" DECIMAL(36,18) NOT NULL,
    "reserved" DECIMAL(36,18) NOT NULL,
    "total" DECIMAL(36,18) NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_audits" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_status_history" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "from_status" "WalletStatus",
    "to_status" "WalletStatus" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_code_key" ON "assets"("code");

-- CreateIndex
CREATE INDEX "assets_chain_standard_idx" ON "assets"("chain", "standard");

-- CreateIndex
CREATE INDEX "wallets_owner_user_id_status_idx" ON "wallets"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "wallets_asset_id_idx" ON "wallets"("asset_id");

-- CreateIndex
CREATE INDEX "wallets_created_at_idx" ON "wallets"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_owner_user_id_asset_id_alias_key" ON "wallets"("owner_user_id", "asset_id", "alias");

-- CreateIndex
CREATE INDEX "wallet_balances_wallet_id_idx" ON "wallet_balances"("wallet_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_balances_wallet_id_asset_id_key" ON "wallet_balances"("wallet_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_reference_key" ON "wallet_transactions"("reference");

-- CreateIndex
CREATE INDEX "wallet_transactions_from_wallet_id_created_at_idx" ON "wallet_transactions"("from_wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_to_wallet_id_created_at_idx" ON "wallet_transactions"("to_wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_status_created_at_idx" ON "wallet_transactions"("status", "created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_initiated_by_idx" ON "wallet_transactions"("initiated_by");

-- CreateIndex
CREATE INDEX "ledger_entries_wallet_id_created_at_idx" ON "ledger_entries"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "ledger_entries_reference_idx" ON "ledger_entries"("reference");

-- CreateIndex
CREATE INDEX "ledger_entries_created_at_idx" ON "ledger_entries"("created_at");

-- CreateIndex
CREATE INDEX "balance_snapshots_wallet_id_captured_at_idx" ON "balance_snapshots"("wallet_id", "captured_at");

-- CreateIndex
CREATE INDEX "balance_audits_wallet_id_created_at_idx" ON "balance_audits"("wallet_id", "created_at");

-- CreateIndex
CREATE INDEX "wallet_status_history_wallet_id_created_at_idx" ON "wallet_status_history"("wallet_id", "created_at");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_from_wallet_id_fkey" FOREIGN KEY ("from_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_to_wallet_id_fkey" FOREIGN KEY ("to_wallet_id") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_to_asset_id_fkey" FOREIGN KEY ("to_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "wallet_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_audits" ADD CONSTRAINT "balance_audits_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_audits" ADD CONSTRAINT "balance_audits_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_status_history" ADD CONSTRAINT "wallet_status_history_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
