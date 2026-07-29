-- Phase 26: Enterprise Web3 Connectivity & dApp Platform

CREATE TYPE "DappConnectionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "TrustedDappStatus" AS ENUM ('TRUSTED', 'REVOKED');
CREATE TYPE "DappPermissionCode" AS ENUM (
  'VIEW_ADDRESSES',
  'VIEW_BALANCES',
  'REQUEST_SIGNATURES',
  'REQUEST_TRANSACTIONS',
  'NETWORK_SWITCH',
  'SESSION_MANAGE'
);

CREATE TABLE "trusted_dapps" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "origin" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon_url" TEXT,
  "networks" JSONB NOT NULL,
  "default_permissions" JSONB NOT NULL,
  "status" "TrustedDappStatus" NOT NULL DEFAULT 'TRUSTED',
  "trusted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "last_connected_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "trusted_dapps_user_id_origin_key" ON "trusted_dapps"("user_id", "origin");
CREATE INDEX "trusted_dapps_user_id_status_idx" ON "trusted_dapps"("user_id", "status");

CREATE TABLE "dapp_connection_requests" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "origin" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "icon_url" TEXT,
  "requested_networks" JSONB NOT NULL,
  "requested_permissions" JSONB NOT NULL,
  "status" "DappConnectionRequestStatus" NOT NULL DEFAULT 'PENDING',
  "proposal_nonce" TEXT NOT NULL,
  "session_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "decided_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "dapp_connection_requests_proposal_nonce_key" ON "dapp_connection_requests"("proposal_nonce");
CREATE INDEX "dapp_connection_requests_user_id_status_idx" ON "dapp_connection_requests"("user_id", "status");
CREATE INDEX "dapp_connection_requests_origin_status_idx" ON "dapp_connection_requests"("origin", "status");
CREATE INDEX "dapp_connection_requests_expires_at_idx" ON "dapp_connection_requests"("expires_at");

CREATE TABLE "dapp_permission_grants" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "origin" TEXT NOT NULL,
  "session_id" UUID,
  "trusted_dapp_id" UUID,
  "permission" "DappPermissionCode" NOT NULL,
  "allowed" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "dapp_permission_grants_user_id_origin_permission_key" ON "dapp_permission_grants"("user_id", "origin", "permission");
CREATE INDEX "dapp_permission_grants_user_id_origin_idx" ON "dapp_permission_grants"("user_id", "origin");
CREATE INDEX "dapp_permission_grants_session_id_idx" ON "dapp_permission_grants"("session_id");

CREATE TABLE "dapp_browser_bookmarks" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "favicon_url" TEXT,
  "last_visited_at" TIMESTAMP(3),
  "visit_count" INTEGER NOT NULL DEFAULT 0,
  "is_trusted" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "dapp_browser_bookmarks_user_id_url_key" ON "dapp_browser_bookmarks"("user_id", "url");
CREATE INDEX "dapp_browser_bookmarks_user_id_last_visited_at_idx" ON "dapp_browser_bookmarks"("user_id", "last_visited_at");

CREATE TABLE "dapp_activity_events" (
  "id" UUID PRIMARY KEY,
  "user_id" UUID NOT NULL,
  "origin" TEXT,
  "session_id" UUID,
  "event_type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "dapp_activity_events_user_id_created_at_idx" ON "dapp_activity_events"("user_id", "created_at");
CREATE INDEX "dapp_activity_events_origin_created_at_idx" ON "dapp_activity_events"("origin", "created_at");
