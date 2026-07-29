-- Phase 19: Market Data & Portfolio Intelligence
-- Requires PostgreSQL 15+ for ADD VALUE IF NOT EXISTS (idempotent enum extension).

ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'MARKET';
ALTER TYPE "AnalyticsDomain" ADD VALUE IF NOT EXISTS 'MARKET';
ALTER TYPE "ObsServiceDomain" ADD VALUE IF NOT EXISTS 'MARKET_DATA';

DO $$ BEGIN
  CREATE TYPE "MarketTokenVerification" AS ENUM ('UNVERIFIED', 'VERIFIED', 'SUSPICIOUS');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OhlcInterval" AS ENUM ('MINUTE', 'HOUR', 'DAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PriceAlertCondition" AS ENUM (
    'ABOVE_PRICE',
    'BELOW_PRICE',
    'PERCENTAGE_MOVEMENT',
    'DAILY_MOVEMENT',
    'LARGE_VOLUME_MOVEMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PriceAlertStatus" AS ENUM ('ACTIVE', 'TRIGGERED', 'DISABLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "asset_market_metadata" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "asset_id" UUID,
  "network" "ChainNetwork" NOT NULL,
  "symbol" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "logo_url" TEXT,
  "decimals" INTEGER NOT NULL DEFAULT 8,
  "contract_address" TEXT NOT NULL DEFAULT '',
  "token_type" "AssetStandard" NOT NULL DEFAULT 'NATIVE',
  "verification_status" "MarketTokenVerification" NOT NULL DEFAULT 'UNVERIFIED',
  "circulating_supply" DECIMAL(36,18),
  "total_supply" DECIMAL(36,18),
  "max_supply" DECIMAL(36,18),
  "market_cap_usd" DECIMAL(36,8),
  "fully_diluted_valuation_usd" DECIMAL(36,8),
  "volume_24h_usd" DECIMAL(36,8),
  "external_ids" JSONB,
  "metadata" JSONB,
  "synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_market_metadata_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_market_metadata_asset_id_key" ON "asset_market_metadata"("asset_id");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_market_metadata_network_symbol_contract_address_key"
  ON "asset_market_metadata"("network", "symbol", "contract_address");
CREATE INDEX IF NOT EXISTS "asset_market_metadata_symbol_network_idx" ON "asset_market_metadata"("symbol", "network");
CREATE INDEX IF NOT EXISTS "asset_market_metadata_verification_status_idx" ON "asset_market_metadata"("verification_status");

DO $$ BEGIN
  ALTER TABLE "asset_market_metadata"
    ADD CONSTRAINT "asset_market_metadata_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "price_quotes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "metadata_id" UUID NOT NULL,
  "quote_currency" TEXT NOT NULL DEFAULT 'USD',
  "price" DECIMAL(36,18) NOT NULL,
  "change_24h_pct" DECIMAL(18,8),
  "change_7d_pct" DECIMAL(18,8),
  "market_cap_usd" DECIMAL(36,8),
  "volume_24h_usd" DECIMAL(36,8),
  "source" TEXT NOT NULL,
  "as_of" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_quotes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "price_quotes_metadata_id_as_of_idx" ON "price_quotes"("metadata_id", "as_of");
CREATE INDEX IF NOT EXISTS "price_quotes_as_of_idx" ON "price_quotes"("as_of");

DO $$ BEGIN
  ALTER TABLE "price_quotes"
    ADD CONSTRAINT "price_quotes_metadata_id_fkey"
    FOREIGN KEY ("metadata_id") REFERENCES "asset_market_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ohlc_candles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "metadata_id" UUID NOT NULL,
  "interval" "OhlcInterval" NOT NULL,
  "bucket_start" TIMESTAMP(3) NOT NULL,
  "open" DECIMAL(36,18) NOT NULL,
  "high" DECIMAL(36,18) NOT NULL,
  "low" DECIMAL(36,18) NOT NULL,
  "close" DECIMAL(36,18) NOT NULL,
  "volume" DECIMAL(36,18),
  "source" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ohlc_candles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ohlc_candles_metadata_id_interval_bucket_start_key"
  ON "ohlc_candles"("metadata_id", "interval", "bucket_start");
CREATE INDEX IF NOT EXISTS "ohlc_candles_metadata_id_interval_bucket_start_idx"
  ON "ohlc_candles"("metadata_id", "interval", "bucket_start");

DO $$ BEGIN
  ALTER TABLE "ohlc_candles"
    ADD CONSTRAINT "ohlc_candles_metadata_id_fkey"
    FOREIGN KEY ("metadata_id") REFERENCES "asset_market_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "market_watchlists" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Default',
  "is_default" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_watchlists_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "market_watchlists_owner_user_id_idx" ON "market_watchlists"("owner_user_id");

CREATE TABLE IF NOT EXISTS "market_watchlist_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "watchlist_id" UUID NOT NULL,
  "metadata_id" UUID NOT NULL,
  "is_favorite" BOOLEAN NOT NULL DEFAULT false,
  "is_pinned" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_watchlist_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "market_watchlist_items_watchlist_id_metadata_id_key"
  ON "market_watchlist_items"("watchlist_id", "metadata_id");
CREATE INDEX IF NOT EXISTS "market_watchlist_items_watchlist_id_sort_order_idx"
  ON "market_watchlist_items"("watchlist_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "market_watchlist_items"
    ADD CONSTRAINT "market_watchlist_items_watchlist_id_fkey"
    FOREIGN KEY ("watchlist_id") REFERENCES "market_watchlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "market_watchlist_items"
    ADD CONSTRAINT "market_watchlist_items_metadata_id_fkey"
    FOREIGN KEY ("metadata_id") REFERENCES "asset_market_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "price_alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "metadata_id" UUID NOT NULL,
  "condition" "PriceAlertCondition" NOT NULL,
  "threshold" DECIMAL(36,18) NOT NULL,
  "quote_currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "PriceAlertStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_triggered_at" TIMESTAMP(3),
  "cooldown_seconds" INTEGER NOT NULL DEFAULT 3600,
  "notification_channels" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "price_alerts_owner_user_id_status_idx" ON "price_alerts"("owner_user_id", "status");
CREATE INDEX IF NOT EXISTS "price_alerts_metadata_id_status_idx" ON "price_alerts"("metadata_id", "status");

DO $$ BEGIN
  ALTER TABLE "price_alerts"
    ADD CONSTRAINT "price_alerts_metadata_id_fkey"
    FOREIGN KEY ("metadata_id") REFERENCES "asset_market_metadata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "portfolio_value_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_user_id" UUID NOT NULL,
  "total_value_usd" DECIMAL(36,8) NOT NULL,
  "network_breakdown" JSONB NOT NULL,
  "token_allocation" JSONB NOT NULL,
  "as_of" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "portfolio_value_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "portfolio_value_snapshots_owner_user_id_as_of_idx"
  ON "portfolio_value_snapshots"("owner_user_id", "as_of");

CREATE TABLE IF NOT EXISTS "market_provider_health" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_success_at" TIMESTAMP(3),
  "last_failure_at" TIMESTAMP(3),
  "last_latency_ms" INTEGER,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_provider_health_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "market_provider_health_code_key" ON "market_provider_health"("code");
