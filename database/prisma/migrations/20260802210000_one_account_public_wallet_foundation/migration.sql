-- One-account foundation: device metadata + public address ownership (no private keys)

ALTER TABLE "devices"
  ADD COLUMN IF NOT EXISTS "platform" TEXT,
  ADD COLUMN IF NOT EXISTS "app_version" TEXT;

CREATE INDEX IF NOT EXISTS "devices_user_id_revoked_at_idx" ON "devices"("user_id", "revoked_at");

ALTER TABLE "watch_addresses"
  ADD COLUMN IF NOT EXISTS "link_mode" TEXT NOT NULL DEFAULT 'watch_only',
  ADD COLUMN IF NOT EXISTS "ownership_verified_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "watch_addresses_user_id_ownership_verified_at_idx"
  ON "watch_addresses"("user_id", "ownership_verified_at");

CREATE TABLE IF NOT EXISTS "address_ownership_challenges" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "network" "ChainNetwork" NOT NULL,
  "address" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "address_ownership_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "address_ownership_challenges_nonce_key"
  ON "address_ownership_challenges"("nonce");
CREATE INDEX IF NOT EXISTS "address_ownership_challenges_user_id_address_idx"
  ON "address_ownership_challenges"("user_id", "address");
CREATE INDEX IF NOT EXISTS "address_ownership_challenges_expires_at_idx"
  ON "address_ownership_challenges"("expires_at");
