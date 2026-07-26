-- CreateEnum
CREATE TYPE "KycSubjectType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "KycLevel" AS ENUM ('NONE', 'BASIC', 'STANDARD', 'ENHANCED', 'FULL');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'PENDING_PROVIDER', 'APPROVED', 'REJECTED', 'EXPIRED', 'RENEWAL_REQUIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'DRIVER_LICENSE', 'NATIONAL_ID', 'PROOF_OF_ADDRESS', 'SELFIE', 'LIVENESS', 'INCORPORATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiskBand" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AmlAlertSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AmlAlertStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ESCALATED', 'CLOSED_FALSE_POSITIVE', 'CLOSED_CONFIRMED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'ASSIGNED', 'INVESTIGATING', 'ESCALATED', 'PENDING_EXTERNAL', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ScreeningMatchStatus" AS ENUM ('CLEAR', 'POTENTIAL', 'CONFIRMED', 'FALSE_POSITIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "ComplianceRuleAction" AS ENUM ('ALLOW', 'FLAG', 'HOLD', 'BLOCK', 'REQUIRE_REVIEW', 'OPEN_CASE');

-- CreateEnum
CREATE TYPE "ComplianceProviderType" AS ENUM ('IDENTITY', 'DOCUMENT', 'SANCTIONS', 'PEP', 'ADDRESS_RISK', 'BLOCKCHAIN_ANALYTICS', 'FRAUD', 'RISK_SCORING', 'TRAVEL_RULE');

-- CreateTable
CREATE TABLE "compliance_providers" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider_type" "ComplianceProviderType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "capabilities" JSONB,
    "endpoint_url" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_provider_health_snapshots" (
    "id" UUID NOT NULL,
    "provider_id" UUID,
    "provider_code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "error_message" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_provider_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_profiles" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "subject_type" "KycSubjectType" NOT NULL DEFAULT 'INDIVIDUAL',
    "level" "KycLevel" NOT NULL DEFAULT 'NONE',
    "status" "VerificationStatus" NOT NULL DEFAULT 'DRAFT',
    "country" TEXT,
    "nationality" TEXT,
    "legal_name_encrypted" TEXT,
    "date_of_birth_encrypted" TEXT,
    "business_name_encrypted" TEXT,
    "risk_band" "RiskBand" NOT NULL DEFAULT 'LOW',
    "risk_score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "last_screened_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "requested_level" "KycLevel" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "provider_code" TEXT,
    "provider_ref" TEXT,
    "rejection_reason" TEXT,
    "reviewer_user_id" UUID,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_documents" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "verification_request_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "storage_key_encrypted" TEXT NOT NULL,
    "content_type" TEXT,
    "file_name" TEXT,
    "checksum_sha256" TEXT,
    "provider_ref" TEXT,
    "rejection_reason" TEXT,
    "verified_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_score_records" (
    "id" UUID NOT NULL,
    "profile_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "band" "RiskBand" NOT NULL,
    "factors" JSONB NOT NULL,
    "provider_code" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_score_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_alerts" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "payment_id" UUID,
    "wallet_id" UUID,
    "rule_code" TEXT NOT NULL,
    "severity" "AmlAlertSeverity" NOT NULL,
    "status" "AmlAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(36,18),
    "currency" TEXT,
    "evidence" JSONB,
    "case_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aml_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_cases" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "owner_user_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "CasePriority" NOT NULL DEFAULT 'MEDIUM',
    "assigned_to_user_id" UUID,
    "opened_by_user_id" UUID,
    "resolution" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_case_notes" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_case_attachments" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "storage_key_encrypted" TEXT NOT NULL,
    "fileName" TEXT,
    "content_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_case_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_case_audits" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_case_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanctions_screening_results" (
    "id" UUID NOT NULL,
    "profile_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "list_source" TEXT NOT NULL,
    "match_status" "ScreeningMatchStatus" NOT NULL DEFAULT 'PENDING',
    "match_score" DECIMAL(10,4),
    "matched_name" TEXT,
    "provider_code" TEXT,
    "provider_ref" TEXT,
    "raw_result" JSONB,
    "screened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sanctions_screening_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pep_screening_results" (
    "id" UUID NOT NULL,
    "profile_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "match_status" "ScreeningMatchStatus" NOT NULL DEFAULT 'PENDING',
    "match_score" DECIMAL(10,4),
    "matched_name" TEXT,
    "provider_code" TEXT,
    "provider_ref" TEXT,
    "raw_result" JSONB,
    "screened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pep_screening_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_rule_records" (
    "id" UUID NOT NULL,
    "profile_id" UUID,
    "owner_user_id" UUID NOT NULL,
    "payment_id" UUID,
    "direction" TEXT NOT NULL,
    "counterparty_vasp" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload_encrypted" TEXT,
    "provider_code" TEXT,
    "provider_ref" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_rule_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_rules" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "action" "ComplianceRuleAction" NOT NULL,
    "expression" JSONB NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_audit_records" (
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

    CONSTRAINT "compliance_audit_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_event_logs" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "aggregate_id" UUID,
    "payload" JSONB NOT NULL,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compliance_providers_code_key" ON "compliance_providers"("code");

-- CreateIndex
CREATE INDEX "compliance_providers_provider_type_is_enabled_priority_idx" ON "compliance_providers"("provider_type", "is_enabled", "priority");

-- CreateIndex
CREATE INDEX "compliance_provider_health_snapshots_provider_code_checked__idx" ON "compliance_provider_health_snapshots"("provider_code", "checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "kyc_profiles_owner_user_id_key" ON "kyc_profiles"("owner_user_id");

-- CreateIndex
CREATE INDEX "kyc_profiles_status_level_idx" ON "kyc_profiles"("status", "level");

-- CreateIndex
CREATE INDEX "kyc_profiles_risk_band_updated_at_idx" ON "kyc_profiles"("risk_band", "updated_at");

-- CreateIndex
CREATE INDEX "verification_requests_owner_user_id_status_created_at_idx" ON "verification_requests"("owner_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "verification_requests_status_submitted_at_idx" ON "verification_requests"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "verification_requests_profile_id_created_at_idx" ON "verification_requests"("profile_id", "created_at");

-- CreateIndex
CREATE INDEX "compliance_documents_owner_user_id_document_type_idx" ON "compliance_documents"("owner_user_id", "document_type");

-- CreateIndex
CREATE INDEX "compliance_documents_verification_request_id_idx" ON "compliance_documents"("verification_request_id");

-- CreateIndex
CREATE INDEX "compliance_documents_status_created_at_idx" ON "compliance_documents"("status", "created_at");

-- CreateIndex
CREATE INDEX "risk_score_records_owner_user_id_created_at_idx" ON "risk_score_records"("owner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "risk_score_records_band_created_at_idx" ON "risk_score_records"("band", "created_at");

-- CreateIndex
CREATE INDEX "aml_alerts_status_severity_created_at_idx" ON "aml_alerts"("status", "severity", "created_at");

-- CreateIndex
CREATE INDEX "aml_alerts_owner_user_id_created_at_idx" ON "aml_alerts"("owner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "aml_alerts_rule_code_created_at_idx" ON "aml_alerts"("rule_code", "created_at");

-- CreateIndex
CREATE INDEX "aml_alerts_payment_id_idx" ON "aml_alerts"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_cases_reference_key" ON "compliance_cases"("reference");

-- CreateIndex
CREATE INDEX "compliance_cases_status_priority_created_at_idx" ON "compliance_cases"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "compliance_cases_assigned_to_user_id_status_idx" ON "compliance_cases"("assigned_to_user_id", "status");

-- CreateIndex
CREATE INDEX "compliance_cases_owner_user_id_created_at_idx" ON "compliance_cases"("owner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "compliance_case_notes_case_id_created_at_idx" ON "compliance_case_notes"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "compliance_case_attachments_case_id_created_at_idx" ON "compliance_case_attachments"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "compliance_case_audits_case_id_created_at_idx" ON "compliance_case_audits"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "sanctions_screening_results_owner_user_id_screened_at_idx" ON "sanctions_screening_results"("owner_user_id", "screened_at");

-- CreateIndex
CREATE INDEX "sanctions_screening_results_match_status_screened_at_idx" ON "sanctions_screening_results"("match_status", "screened_at");

-- CreateIndex
CREATE INDEX "sanctions_screening_results_list_source_match_status_idx" ON "sanctions_screening_results"("list_source", "match_status");

-- CreateIndex
CREATE INDEX "pep_screening_results_owner_user_id_screened_at_idx" ON "pep_screening_results"("owner_user_id", "screened_at");

-- CreateIndex
CREATE INDEX "pep_screening_results_match_status_screened_at_idx" ON "pep_screening_results"("match_status", "screened_at");

-- CreateIndex
CREATE INDEX "travel_rule_records_owner_user_id_created_at_idx" ON "travel_rule_records"("owner_user_id", "created_at");

-- CreateIndex
CREATE INDEX "travel_rule_records_payment_id_idx" ON "travel_rule_records"("payment_id");

-- CreateIndex
CREATE INDEX "travel_rule_records_status_created_at_idx" ON "travel_rule_records"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_rules_code_key" ON "compliance_rules"("code");

-- CreateIndex
CREATE INDEX "compliance_rules_is_enabled_priority_idx" ON "compliance_rules"("is_enabled", "priority");

-- CreateIndex
CREATE INDEX "compliance_audit_records_action_created_at_idx" ON "compliance_audit_records"("action", "created_at");

-- CreateIndex
CREATE INDEX "compliance_audit_records_subject_user_id_created_at_idx" ON "compliance_audit_records"("subject_user_id", "created_at");

-- CreateIndex
CREATE INDEX "compliance_audit_records_resource_type_resource_id_idx" ON "compliance_audit_records"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "compliance_event_logs_event_type_created_at_idx" ON "compliance_event_logs"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "compliance_event_logs_aggregate_id_created_at_idx" ON "compliance_event_logs"("aggregate_id", "created_at");

-- AddForeignKey
ALTER TABLE "compliance_provider_health_snapshots" ADD CONSTRAINT "compliance_provider_health_snapshots_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "compliance_providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "kyc_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "kyc_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_verification_request_id_fkey" FOREIGN KEY ("verification_request_id") REFERENCES "verification_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_score_records" ADD CONSTRAINT "risk_score_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "kyc_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aml_alerts" ADD CONSTRAINT "aml_alerts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "compliance_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_case_notes" ADD CONSTRAINT "compliance_case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "compliance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_case_attachments" ADD CONSTRAINT "compliance_case_attachments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "compliance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_case_audits" ADD CONSTRAINT "compliance_case_audits_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "compliance_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions_screening_results" ADD CONSTRAINT "sanctions_screening_results_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "kyc_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pep_screening_results" ADD CONSTRAINT "pep_screening_results_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "kyc_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_rule_records" ADD CONSTRAINT "travel_rule_records_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "kyc_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;


