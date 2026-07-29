-- Phase 21 — NFT & Digital Asset Management

CREATE TYPE "NftMediaKind" AS ENUM ('IMAGE', 'ANIMATION', 'VIDEO');
CREATE TYPE "NftMediaCacheStatus" AS ENUM ('PENDING', 'READY', 'FAILED');
CREATE TYPE "NftSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "NftRetryJobStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

CREATE TABLE "nft_collections" (
    "id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT,
    "contract_address" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "creator_address" TEXT,
    "total_supply" INTEGER NOT NULL DEFAULT 0,
    "owners_count" INTEGER NOT NULL DEFAULT 0,
    "floor_price_usd" DECIMAL(36,8),
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_collections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nft_assets" (
    "id" UUID NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "standard" TEXT NOT NULL,
    "contract_address" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "owner_address" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image_url" TEXT,
    "animation_url" TEXT,
    "video_url" TEXT,
    "collection_id" UUID NOT NULL,
    "traits" JSONB NOT NULL,
    "balance" TEXT NOT NULL DEFAULT '1',
    "verified_collection" BOOLEAN NOT NULL DEFAULT false,
    "creator_address" TEXT,
    "raw_metadata" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nft_ownerships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "owner_address" TEXT NOT NULL,
    "is_favorite" BOOLEAN NOT NULL DEFAULT false,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_ownerships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nft_media_cache" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "kind" "NftMediaKind" NOT NULL,
    "source_url" TEXT NOT NULL,
    "cached_url" TEXT,
    "content_type" TEXT,
    "bytes" INTEGER NOT NULL DEFAULT 0,
    "status" "NftMediaCacheStatus" NOT NULL DEFAULT 'PENDING',
    "last_fetched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_media_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nft_provider_health" (
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

    CONSTRAINT "nft_provider_health_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nft_sync_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "network" "ChainNetwork",
    "job_type" TEXT NOT NULL,
    "status" "NftSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_sync_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nft_retry_jobs" (
    "id" UUID NOT NULL,
    "asset_id" UUID,
    "job_type" TEXT NOT NULL,
    "status" "NftRetryJobStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nft_retry_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "nft_collections_network_slug_key" ON "nft_collections"("network", "slug");
CREATE INDEX "nft_collections_network_verified_idx" ON "nft_collections"("network", "verified");

CREATE UNIQUE INDEX "nft_assets_network_contract_address_token_id_key" ON "nft_assets"("network", "contract_address", "token_id");
CREATE INDEX "nft_assets_owner_address_idx" ON "nft_assets"("owner_address");
CREATE INDEX "nft_assets_collection_id_idx" ON "nft_assets"("collection_id");

CREATE UNIQUE INDEX "nft_ownerships_user_id_asset_id_key" ON "nft_ownerships"("user_id", "asset_id");
CREATE INDEX "nft_ownerships_user_id_is_favorite_idx" ON "nft_ownerships"("user_id", "is_favorite");
CREATE INDEX "nft_ownerships_user_id_is_hidden_idx" ON "nft_ownerships"("user_id", "is_hidden");

CREATE UNIQUE INDEX "nft_media_cache_asset_id_kind_key" ON "nft_media_cache"("asset_id", "kind");
CREATE INDEX "nft_media_cache_status_idx" ON "nft_media_cache"("status");

CREATE UNIQUE INDEX "nft_provider_health_code_key" ON "nft_provider_health"("code");
CREATE INDEX "nft_sync_jobs_status_created_at_idx" ON "nft_sync_jobs"("status", "created_at");
CREATE INDEX "nft_retry_jobs_status_created_at_idx" ON "nft_retry_jobs"("status", "created_at");

ALTER TABLE "nft_assets" ADD CONSTRAINT "nft_assets_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "nft_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nft_ownerships" ADD CONSTRAINT "nft_ownerships_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "nft_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nft_media_cache" ADD CONSTRAINT "nft_media_cache_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "nft_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
