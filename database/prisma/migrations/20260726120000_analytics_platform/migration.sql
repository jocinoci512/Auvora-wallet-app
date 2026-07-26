-- Phase 10: Enterprise Analytics / BI Platform

CREATE TYPE "AnalyticsDomain" AS ENUM ('AUTH', 'WALLET', 'BLOCKCHAIN', 'PAYMENTS', 'COMPLIANCE', 'KYC', 'AML', 'RISK', 'FRAUD', 'CUSTODY', 'AI', 'NOTIFICATIONS', 'INFRASTRUCTURE', 'SYSTEM', 'CUSTOMER', 'ADMIN');
CREATE TYPE "MetricValueType" AS ENUM ('COUNTER', 'GAUGE', 'RATE', 'RATIO', 'CURRENCY', 'DURATION_MS');
CREATE TYPE "AggregationWindow" AS ENUM ('REALTIME', 'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');
CREATE TYPE "AggregationJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "ReportFormat" AS ENUM ('PDF', 'CSV', 'XLSX', 'JSON');
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'READY', 'GENERATING', 'FAILED', 'ARCHIVED');
CREATE TYPE "ScheduledReportStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED');
CREATE TYPE "DashboardVisibility" AS ENUM ('PRIVATE', 'SHARED', 'ORGANIZATION', 'SYSTEM');
CREATE TYPE "ForecastHorizon" AS ENUM ('DAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR');
CREATE TYPE "ForecastStatus" AS ENUM ('DRAFT', 'READY', 'RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "domain" "AnalyticsDomain" NOT NULL,
    "aggregate_id" TEXT,
    "owner_user_id" UUID,
    "payload" JSONB NOT NULL,
    "metrics" JSONB,
    "correlation_id" TEXT,
    "source_service" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "metric_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "AnalyticsDomain" NOT NULL,
    "value_type" "MetricValueType" NOT NULL,
    "unit" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "formula" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "metric_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "metric_values" (
    "id" UUID NOT NULL,
    "metric_id" UUID NOT NULL,
    "window" "AggregationWindow" NOT NULL,
    "bucket_start" TIMESTAMP(3) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB,
    "sample_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "metric_values_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kpi_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "AnalyticsDomain" NOT NULL,
    "metric_code" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION,
    "warning_threshold" DOUBLE PRECISION,
    "critical_threshold" DOUBLE PRECISION,
    "higher_is_better" BOOLEAN NOT NULL DEFAULT true,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_dashboards" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "AnalyticsDomain",
    "visibility" "DashboardVisibility" NOT NULL DEFAULT 'PRIVATE',
    "owner_user_id" UUID,
    "layout" JSONB,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "analytics_dashboards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dashboard_widgets" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "widget_type" TEXT NOT NULL,
    "metric_code" TEXT,
    "kpi_code" TEXT,
    "config" JSONB,
    "position_x" INTEGER NOT NULL DEFAULT 0,
    "position_y" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER NOT NULL DEFAULT 4,
    "height" INTEGER NOT NULL DEFAULT 2,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "report_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "AnalyticsDomain" NOT NULL,
    "query_spec" JSONB NOT NULL,
    "default_format" "ReportFormat" NOT NULL DEFAULT 'JSON',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_reports" (
    "id" UUID NOT NULL,
    "template_id" UUID,
    "owner_user_id" UUID,
    "name" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT',
    "format" "ReportFormat" NOT NULL DEFAULT 'JSON',
    "parameters" JSONB,
    "result_encrypted" TEXT,
    "result_checksum" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMP(3),
    "error_message" TEXT,
    "correlation_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "analytics_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "owner_user_id" UUID,
    "name" TEXT NOT NULL,
    "cron_expression" TEXT NOT NULL,
    "format" "ReportFormat" NOT NULL DEFAULT 'JSON',
    "parameters" JSONB,
    "status" "ScheduledReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_models" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "AnalyticsDomain" NOT NULL,
    "metric_code" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'linear_trend',
    "horizon" "ForecastHorizon" NOT NULL DEFAULT 'MONTH',
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "forecast_models_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "forecast_results" (
    "id" UUID NOT NULL,
    "model_id" UUID NOT NULL,
    "status" "ForecastStatus" NOT NULL DEFAULT 'DRAFT',
    "horizon_start" TIMESTAMP(3) NOT NULL,
    "horizon_end" TIMESTAMP(3) NOT NULL,
    "points" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION,
    "generated_at" TIMESTAMP(3),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "forecast_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "aggregation_jobs" (
    "id" UUID NOT NULL,
    "job_type" TEXT NOT NULL,
    "window" "AggregationWindow" NOT NULL,
    "status" "AggregationJobStatus" NOT NULL DEFAULT 'PENDING',
    "domain" "AnalyticsDomain",
    "bucket_start" TIMESTAMP(3),
    "bucket_end" TIMESTAMP(3),
    "processed_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "aggregation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_audit_records" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "subject_user_id" UUID,
    "resource_type" TEXT,
    "resource_id" UUID,
    "details" JSONB,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "analytics_audit_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_domain_occurred_at_idx" ON "analytics_events"("domain", "occurred_at");
CREATE INDEX "analytics_events_event_type_occurred_at_idx" ON "analytics_events"("event_type", "occurred_at");
CREATE INDEX "analytics_events_owner_user_id_occurred_at_idx" ON "analytics_events"("owner_user_id", "occurred_at");
CREATE INDEX "analytics_events_correlation_id_idx" ON "analytics_events"("correlation_id");
CREATE INDEX "analytics_events_processed_at_idx" ON "analytics_events"("processed_at");

CREATE UNIQUE INDEX "metric_definitions_code_key" ON "metric_definitions"("code");
CREATE INDEX "metric_definitions_domain_is_enabled_idx" ON "metric_definitions"("domain", "is_enabled");

CREATE UNIQUE INDEX "metric_values_metric_id_window_bucket_start_key" ON "metric_values"("metric_id", "window", "bucket_start");
CREATE INDEX "metric_values_bucket_start_idx" ON "metric_values"("bucket_start");
CREATE INDEX "metric_values_metric_id_bucket_start_idx" ON "metric_values"("metric_id", "bucket_start");

CREATE UNIQUE INDEX "kpi_definitions_code_key" ON "kpi_definitions"("code");
CREATE INDEX "kpi_definitions_domain_is_enabled_idx" ON "kpi_definitions"("domain", "is_enabled");

CREATE UNIQUE INDEX "analytics_dashboards_code_key" ON "analytics_dashboards"("code");
CREATE INDEX "analytics_dashboards_owner_user_id_visibility_idx" ON "analytics_dashboards"("owner_user_id", "visibility");
CREATE INDEX "analytics_dashboards_is_system_is_enabled_idx" ON "analytics_dashboards"("is_system", "is_enabled");

CREATE INDEX "dashboard_widgets_dashboard_id_idx" ON "dashboard_widgets"("dashboard_id");

CREATE UNIQUE INDEX "report_templates_code_key" ON "report_templates"("code");
CREATE INDEX "report_templates_domain_is_enabled_idx" ON "report_templates"("domain", "is_enabled");

CREATE INDEX "analytics_reports_owner_user_id_created_at_idx" ON "analytics_reports"("owner_user_id", "created_at");
CREATE INDEX "analytics_reports_status_created_at_idx" ON "analytics_reports"("status", "created_at");
CREATE INDEX "analytics_reports_template_id_version_idx" ON "analytics_reports"("template_id", "version");

CREATE INDEX "scheduled_reports_status_next_run_at_idx" ON "scheduled_reports"("status", "next_run_at");
CREATE INDEX "scheduled_reports_owner_user_id_idx" ON "scheduled_reports"("owner_user_id");

CREATE UNIQUE INDEX "forecast_models_code_key" ON "forecast_models"("code");
CREATE INDEX "forecast_models_domain_is_enabled_idx" ON "forecast_models"("domain", "is_enabled");

CREATE INDEX "forecast_results_model_id_created_at_idx" ON "forecast_results"("model_id", "created_at");
CREATE INDEX "forecast_results_status_created_at_idx" ON "forecast_results"("status", "created_at");

CREATE INDEX "aggregation_jobs_status_created_at_idx" ON "aggregation_jobs"("status", "created_at");
CREATE INDEX "aggregation_jobs_window_bucket_start_idx" ON "aggregation_jobs"("window", "bucket_start");

CREATE INDEX "analytics_audit_records_action_created_at_idx" ON "analytics_audit_records"("action", "created_at");
CREATE INDEX "analytics_audit_records_subject_user_id_created_at_idx" ON "analytics_audit_records"("subject_user_id", "created_at");

ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "analytics_dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_reports" ADD CONSTRAINT "analytics_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "report_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "forecast_results" ADD CONSTRAINT "forecast_results_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "forecast_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
