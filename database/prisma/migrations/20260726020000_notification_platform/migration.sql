-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'PUSH', 'IN_APP', 'BROWSER', 'WEBHOOK', 'SLACK', 'TEAMS');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('AUTH', 'SECURITY', 'KYC', 'COMPLIANCE', 'PAYMENT', 'DEPOSIT', 'WITHDRAWAL', 'TRANSACTION', 'WALLET', 'CUSTODY', 'RISK', 'SYSTEM', 'MARKETING', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'SCHEDULED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'DEAD_LETTER', 'CANCELLED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "TemplateFormat" AS ENUM ('HTML', 'TEXT', 'MARKDOWN', 'RICH');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'DEAD_LETTER');

-- CreateTable
CREATE TABLE "notification_channel_providers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "config_encrypted" TEXT,
    "health_status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "last_checked_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_channel_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "format" "TemplateFormat" NOT NULL DEFAULT 'HTML',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "time_zone" TEXT NOT NULL DEFAULT 'UTC',
    "quiet_hours_start" INTEGER,
    "quiet_hours_end" INTEGER,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT false,
    "digest_hour" INTEGER,
    "channel_toggles" JSONB NOT NULL DEFAULT '{}',
    "category_toggles" JSONB NOT NULL DEFAULT '{}',
    "frequency_limits" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_messages" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "template_id" UUID,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "payload" JSONB,
    "dedupe_key" TEXT,
    "correlation_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "delay_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "provider_code" TEXT,
    "provider_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_queue_items" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_queue_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_delivery_logs" (
    "id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "provider_code" TEXT,
    "success" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "error_message" TEXT,
    "response_meta" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "event_filters" JSONB,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "endpoint_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "response_code" INTEGER,
    "response_body" TEXT,
    "signature" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_event_logs" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" UUID,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_audit_records" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "subject_user_id" UUID,
    "resource_type" TEXT,
    "resource_id" UUID,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_audit_records_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "notification_channel_providers_code_key" ON "notification_channel_providers"("code");
CREATE INDEX "notification_channel_providers_channel_is_enabled_idx" ON "notification_channel_providers"("channel", "is_enabled");
CREATE INDEX "notification_channel_providers_is_enabled_priority_idx" ON "notification_channel_providers"("is_enabled", "priority");

CREATE UNIQUE INDEX "notification_templates_code_channel_locale_key" ON "notification_templates"("code", "channel", "locale");
CREATE INDEX "notification_templates_category_is_enabled_idx" ON "notification_templates"("category", "is_enabled");
CREATE INDEX "notification_templates_channel_is_enabled_idx" ON "notification_templates"("channel", "is_enabled");

CREATE UNIQUE INDEX "notification_template_versions_template_id_version_key" ON "notification_template_versions"("template_id", "version");
CREATE INDEX "notification_template_versions_template_id_created_at_idx" ON "notification_template_versions"("template_id", "created_at");

CREATE UNIQUE INDEX "notification_preferences_owner_user_id_key" ON "notification_preferences"("owner_user_id");

CREATE UNIQUE INDEX "notification_messages_dedupe_key_key" ON "notification_messages"("dedupe_key");
CREATE INDEX "notification_messages_owner_user_id_created_at_idx" ON "notification_messages"("owner_user_id", "created_at");
CREATE INDEX "notification_messages_status_priority_created_at_idx" ON "notification_messages"("status", "priority", "created_at");
CREATE INDEX "notification_messages_channel_status_idx" ON "notification_messages"("channel", "status");
CREATE INDEX "notification_messages_scheduled_at_idx" ON "notification_messages"("scheduled_at");
CREATE INDEX "notification_messages_category_created_at_idx" ON "notification_messages"("category", "created_at");

CREATE INDEX "notification_queue_items_status_available_at_priority_idx" ON "notification_queue_items"("status", "available_at", "priority");
CREATE INDEX "notification_queue_items_notification_id_idx" ON "notification_queue_items"("notification_id");
CREATE INDEX "notification_queue_items_dead_lettered_at_idx" ON "notification_queue_items"("dead_lettered_at");

CREATE INDEX "notification_delivery_logs_notification_id_created_at_idx" ON "notification_delivery_logs"("notification_id", "created_at");
CREATE INDEX "notification_delivery_logs_channel_success_created_at_idx" ON "notification_delivery_logs"("channel", "success", "created_at");

CREATE INDEX "webhook_endpoints_owner_user_id_is_enabled_idx" ON "webhook_endpoints"("owner_user_id", "is_enabled");
CREATE INDEX "webhook_endpoints_is_enabled_idx" ON "webhook_endpoints"("is_enabled");

CREATE INDEX "webhook_deliveries_endpoint_id_status_idx" ON "webhook_deliveries"("endpoint_id", "status");
CREATE INDEX "webhook_deliveries_status_next_attempt_at_idx" ON "webhook_deliveries"("status", "next_attempt_at");
CREATE INDEX "webhook_deliveries_event_type_created_at_idx" ON "webhook_deliveries"("event_type", "created_at");

CREATE INDEX "notification_event_logs_event_type_created_at_idx" ON "notification_event_logs"("event_type", "created_at");
CREATE INDEX "notification_event_logs_aggregate_id_created_at_idx" ON "notification_event_logs"("aggregate_id", "created_at");

CREATE INDEX "notification_audit_records_action_created_at_idx" ON "notification_audit_records"("action", "created_at");
CREATE INDEX "notification_audit_records_subject_user_id_created_at_idx" ON "notification_audit_records"("subject_user_id", "created_at");

-- FKs
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_messages" ADD CONSTRAINT "notification_messages_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_queue_items" ADD CONSTRAINT "notification_queue_items_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notification_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
