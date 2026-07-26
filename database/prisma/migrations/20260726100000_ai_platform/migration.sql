-- Phase 9: Enterprise AI Platform

CREATE TYPE "AiProviderType" AS ENUM ('OPENAI', 'ANTHROPIC', 'GEMINI', 'AZURE_OPENAI', 'LOCAL', 'SIMULATOR');
CREATE TYPE "AiProviderStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN');
CREATE TYPE "AiPromptCategory" AS ENUM ('SYSTEM', 'SUPPORT', 'WALLET', 'PAYMENT', 'COMPLIANCE', 'FRAUD', 'OPERATIONS', 'ADMIN', 'DEVELOPER', 'DOCUMENTATION', 'AUTOMATION', 'GENERAL');
CREATE TYPE "AiPromptStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ARCHIVED');
CREATE TYPE "AiAssistantType" AS ENUM ('CUSTOMER_SUPPORT', 'WALLET', 'PAYMENT', 'COMPLIANCE', 'FRAUD_ANALYST', 'OPERATIONS', 'ADMIN', 'DEVELOPER', 'DOCUMENTATION');
CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'EXPIRED');
CREATE TYPE "AiMessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');
CREATE TYPE "AiRequestStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'MODERATED', 'CACHED');
CREATE TYPE "AiKnowledgeSourceType" AS ENUM ('MANUAL', 'UPLOAD', 'URL', 'CONNECTOR');
CREATE TYPE "AiDocumentStatus" AS ENUM ('PENDING', 'PARSING', 'CHUNKING', 'EMBEDDING', 'INDEXED', 'FAILED', 'ARCHIVED');

CREATE TABLE "ai_providers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" "AiProviderType" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "base_url" TEXT,
    "default_model" TEXT,
    "config_encrypted" TEXT,
    "health_status" "AiProviderStatus" NOT NULL DEFAULT 'UNKNOWN',
    "last_checked_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_prompt_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "AiPromptCategory" NOT NULL,
    "status" "AiPromptStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_prompt_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "system_prompt" TEXT,
    "user_prompt" TEXT NOT NULL,
    "variables" JSONB,
    "model_hint" TEXT,
    "temperature" DOUBLE PRECISION DEFAULT 0.2,
    "max_tokens" INTEGER,
    "change_notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "assistant_type" "AiAssistantType" NOT NULL DEFAULT 'CUSTOMER_SUPPORT',
    "title" TEXT,
    "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "metadata" JSONB,
    "last_message_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "model" TEXT,
    "provider_code" TEXT,
    "metadata" JSONB,
    "feedback_score" INTEGER,
    "feedback_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "conversation_id" UUID,
    "prompt_template_id" UUID,
    "provider_id" UUID,
    "assistant_type" "AiAssistantType",
    "status" "AiRequestStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT,
    "input_text" TEXT NOT NULL,
    "output_text" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "cache_hit" BOOLEAN NOT NULL DEFAULT false,
    "correlation_id" TEXT,
    "source_event_type" TEXT,
    "source_event_id" TEXT,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_token_usage" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "provider_code" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_token_usage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_provider_metrics" (
    "id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "cache_hit_count" INTEGER NOT NULL DEFAULT 0,
    "total_latency_ms" BIGINT NOT NULL DEFAULT 0,
    "total_tokens" BIGINT NOT NULL DEFAULT 0,
    "total_cost_micros" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_provider_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_knowledge_sources" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source_type" "AiKnowledgeSourceType" NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_documents" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'text/plain',
    "content" TEXT NOT NULL,
    "status" "AiDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "checksum" TEXT,
    "error_message" TEXT,
    "indexed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_document_chunks" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_embeddings" (
    "id" UUID NOT NULL,
    "chunk_id" UUID NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "vector" JSONB NOT NULL,
    "provider_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_vector_index_meta" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "document_count" INTEGER NOT NULL DEFAULT 0,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "last_refresh_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_vector_index_meta_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_audit_records" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "subject_user_id" UUID,
    "resource_type" TEXT,
    "resource_id" UUID,
    "details" JSONB,
    "correlation_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_event_logs" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" UUID,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_event_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_providers_code_key" ON "ai_providers"("code");
CREATE INDEX "ai_providers_is_enabled_priority_idx" ON "ai_providers"("is_enabled", "priority");
CREATE INDEX "ai_providers_provider_type_is_enabled_idx" ON "ai_providers"("provider_type", "is_enabled");

CREATE UNIQUE INDEX "ai_prompt_templates_code_key" ON "ai_prompt_templates"("code");
CREATE INDEX "ai_prompt_templates_category_status_idx" ON "ai_prompt_templates"("category", "status");
CREATE INDEX "ai_prompt_templates_is_enabled_category_idx" ON "ai_prompt_templates"("is_enabled", "category");

CREATE UNIQUE INDEX "ai_prompt_versions_template_id_version_key" ON "ai_prompt_versions"("template_id", "version");
CREATE INDEX "ai_prompt_versions_template_id_created_at_idx" ON "ai_prompt_versions"("template_id", "created_at");

CREATE INDEX "ai_conversations_owner_user_id_status_updated_at_idx" ON "ai_conversations"("owner_user_id", "status", "updated_at");
CREATE INDEX "ai_conversations_assistant_type_created_at_idx" ON "ai_conversations"("assistant_type", "created_at");
CREATE INDEX "ai_conversations_expires_at_idx" ON "ai_conversations"("expires_at");

CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");
CREATE INDEX "ai_messages_role_created_at_idx" ON "ai_messages"("role", "created_at");

CREATE INDEX "ai_requests_owner_user_id_created_at_idx" ON "ai_requests"("owner_user_id", "created_at");
CREATE INDEX "ai_requests_status_created_at_idx" ON "ai_requests"("status", "created_at");
CREATE INDEX "ai_requests_provider_id_created_at_idx" ON "ai_requests"("provider_id", "created_at");
CREATE INDEX "ai_requests_correlation_id_idx" ON "ai_requests"("correlation_id");
CREATE INDEX "ai_requests_source_event_type_created_at_idx" ON "ai_requests"("source_event_type", "created_at");

CREATE UNIQUE INDEX "ai_token_usage_request_id_key" ON "ai_token_usage"("request_id");
CREATE INDEX "ai_token_usage_owner_user_id_created_at_idx" ON "ai_token_usage"("owner_user_id", "created_at");
CREATE INDEX "ai_token_usage_provider_code_created_at_idx" ON "ai_token_usage"("provider_code", "created_at");

CREATE UNIQUE INDEX "ai_provider_metrics_provider_id_window_start_key" ON "ai_provider_metrics"("provider_id", "window_start");
CREATE INDEX "ai_provider_metrics_window_start_idx" ON "ai_provider_metrics"("window_start");

CREATE UNIQUE INDEX "ai_knowledge_sources_code_key" ON "ai_knowledge_sources"("code");
CREATE INDEX "ai_knowledge_sources_is_enabled_source_type_idx" ON "ai_knowledge_sources"("is_enabled", "source_type");

CREATE INDEX "ai_documents_source_id_status_idx" ON "ai_documents"("source_id", "status");
CREATE INDEX "ai_documents_status_updated_at_idx" ON "ai_documents"("status", "updated_at");

CREATE UNIQUE INDEX "ai_document_chunks_document_id_chunk_index_key" ON "ai_document_chunks"("document_id", "chunk_index");
CREATE INDEX "ai_document_chunks_document_id_idx" ON "ai_document_chunks"("document_id");

CREATE UNIQUE INDEX "ai_embeddings_chunk_id_key" ON "ai_embeddings"("chunk_id");
CREATE INDEX "ai_embeddings_model_created_at_idx" ON "ai_embeddings"("model", "created_at");

CREATE UNIQUE INDEX "ai_vector_index_meta_code_key" ON "ai_vector_index_meta"("code");

CREATE INDEX "ai_audit_records_action_created_at_idx" ON "ai_audit_records"("action", "created_at");
CREATE INDEX "ai_audit_records_subject_user_id_created_at_idx" ON "ai_audit_records"("subject_user_id", "created_at");
CREATE INDEX "ai_audit_records_correlation_id_idx" ON "ai_audit_records"("correlation_id");

CREATE INDEX "ai_event_logs_event_type_created_at_idx" ON "ai_event_logs"("event_type", "created_at");
CREATE INDEX "ai_event_logs_aggregate_id_created_at_idx" ON "ai_event_logs"("aggregate_id", "created_at");

ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ai_prompt_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_prompt_template_id_fkey" FOREIGN KEY ("prompt_template_id") REFERENCES "ai_prompt_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_token_usage" ADD CONSTRAINT "ai_token_usage_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_provider_metrics" ADD CONSTRAINT "ai_provider_metrics_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_documents" ADD CONSTRAINT "ai_documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "ai_knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_document_chunks" ADD CONSTRAINT "ai_document_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "ai_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_embeddings" ADD CONSTRAINT "ai_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "ai_document_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
