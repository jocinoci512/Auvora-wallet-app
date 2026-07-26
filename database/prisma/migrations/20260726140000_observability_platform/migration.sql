-- Phase 11: Enterprise Observability / SRE Platform

CREATE TYPE "ObsServiceDomain" AS ENUM ('GATEWAY', 'AUTH', 'WALLET', 'BLOCKCHAIN', 'PAYMENTS', 'COMPLIANCE', 'CUSTODY', 'NOTIFICATIONS', 'AI', 'ANALYTICS', 'OBSERVABILITY', 'INFRASTRUCTURE', 'DATABASE', 'REDIS', 'SYSTEM');
CREATE TYPE "ObsMetricKind" AS ENUM ('COUNTER', 'GAUGE', 'HISTOGRAM', 'SUMMARY');
CREATE TYPE "ObsHealthStatus" AS ENUM ('HEALTHY', 'DEGRADED', 'UNHEALTHY', 'UNKNOWN');
CREATE TYPE "ObsAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'SECURITY');
CREATE TYPE "ObsAlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED');
CREATE TYPE "ObsIncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');
CREATE TYPE "ObsIncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'MITIGATING', 'RESOLVED', 'CLOSED');
CREATE TYPE "ObsSloIndicatorType" AS ENUM ('AVAILABILITY', 'LATENCY', 'ERROR_RATE', 'THROUGHPUT', 'CUSTOM');

CREATE TABLE "obs_metric_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "ObsServiceDomain" NOT NULL,
    "kind" "ObsMetricKind" NOT NULL DEFAULT 'GAUGE',
    "unit" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obs_metric_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_metric_definitions_code_key" ON "obs_metric_definitions"("code");
CREATE INDEX "obs_metric_definitions_domain_is_enabled_idx" ON "obs_metric_definitions"("domain", "is_enabled");

CREATE TABLE "obs_metric_samples" (
    "id" UUID NOT NULL,
    "metric_id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "labels" JSONB,
    "correlation_id" TEXT,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_metric_samples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_metric_samples_metric_id_observed_at_idx" ON "obs_metric_samples"("metric_id", "observed_at");
CREATE INDEX "obs_metric_samples_service_name_observed_at_idx" ON "obs_metric_samples"("service_name", "observed_at");
CREATE INDEX "obs_metric_samples_correlation_id_idx" ON "obs_metric_samples"("correlation_id");

CREATE TABLE "obs_traces" (
    "id" UUID NOT NULL,
    "trace_id" TEXT NOT NULL,
    "root_service" TEXT,
    "root_operation" TEXT,
    "correlation_id" TEXT,
    "status_code" TEXT,
    "duration_ms" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_traces_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_traces_trace_id_key" ON "obs_traces"("trace_id");
CREATE INDEX "obs_traces_started_at_idx" ON "obs_traces"("started_at");
CREATE INDEX "obs_traces_correlation_id_idx" ON "obs_traces"("correlation_id");
CREATE INDEX "obs_traces_root_service_started_at_idx" ON "obs_traces"("root_service", "started_at");

CREATE TABLE "obs_spans" (
    "id" UUID NOT NULL,
    "trace_record_id" UUID NOT NULL,
    "span_id" TEXT NOT NULL,
    "parent_span_id" TEXT,
    "service_name" TEXT NOT NULL,
    "operation_name" TEXT NOT NULL,
    "status_code" TEXT,
    "duration_ms" DOUBLE PRECISION,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "attributes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_spans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_spans_trace_record_id_span_id_key" ON "obs_spans"("trace_record_id", "span_id");
CREATE INDEX "obs_spans_service_name_started_at_idx" ON "obs_spans"("service_name", "started_at");
CREATE INDEX "obs_spans_parent_span_id_idx" ON "obs_spans"("parent_span_id");

CREATE TABLE "obs_log_entries" (
    "id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "domain" "ObsServiceDomain" NOT NULL DEFAULT 'SYSTEM',
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "correlation_id" TEXT,
    "trace_id" TEXT,
    "span_id" TEXT,
    "is_masked" BOOLEAN NOT NULL DEFAULT true,
    "is_immutable" BOOLEAN NOT NULL DEFAULT false,
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_log_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_log_entries_service_name_occurred_at_idx" ON "obs_log_entries"("service_name", "occurred_at");
CREATE INDEX "obs_log_entries_level_occurred_at_idx" ON "obs_log_entries"("level", "occurred_at");
CREATE INDEX "obs_log_entries_correlation_id_idx" ON "obs_log_entries"("correlation_id");
CREATE INDEX "obs_log_entries_trace_id_idx" ON "obs_log_entries"("trace_id");

CREATE TABLE "obs_health_checks" (
    "id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "check_name" TEXT NOT NULL,
    "status" "ObsHealthStatus" NOT NULL DEFAULT 'UNKNOWN',
    "latency_ms" DOUBLE PRECISION,
    "details" JSONB,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_health_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_health_checks_service_name_check_name_checked_at_idx" ON "obs_health_checks"("service_name", "check_name", "checked_at");
CREATE INDEX "obs_health_checks_status_checked_at_idx" ON "obs_health_checks"("status", "checked_at");

CREATE TABLE "obs_service_dependencies" (
    "id" UUID NOT NULL,
    "source_service" TEXT NOT NULL,
    "target_service" TEXT NOT NULL,
    "dependency_type" TEXT NOT NULL DEFAULT 'http',
    "domain" "ObsServiceDomain" NOT NULL DEFAULT 'SYSTEM',
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obs_service_dependencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_service_dependencies_source_service_target_service_dependency_type_key" ON "obs_service_dependencies"("source_service", "target_service", "dependency_type");
CREATE INDEX "obs_service_dependencies_source_service_idx" ON "obs_service_dependencies"("source_service");
CREATE INDEX "obs_service_dependencies_target_service_idx" ON "obs_service_dependencies"("target_service");

CREATE TABLE "obs_alert_rules" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "domain" "ObsServiceDomain" NOT NULL,
    "metric_code" TEXT,
    "rule_type" TEXT NOT NULL DEFAULT 'threshold',
    "severity" "ObsAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "threshold" DOUBLE PRECISION,
    "comparison" TEXT DEFAULT 'gt',
    "window_seconds" INTEGER NOT NULL DEFAULT 300,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obs_alert_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_alert_rules_code_key" ON "obs_alert_rules"("code");
CREATE INDEX "obs_alert_rules_domain_is_enabled_idx" ON "obs_alert_rules"("domain", "is_enabled");

CREATE TABLE "obs_alerts" (
    "id" UUID NOT NULL,
    "rule_id" UUID,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "ObsAlertSeverity" NOT NULL,
    "status" "ObsAlertStatus" NOT NULL DEFAULT 'OPEN',
    "service_name" TEXT,
    "correlation_id" TEXT,
    "fired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obs_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_alerts_status_severity_fired_at_idx" ON "obs_alerts"("status", "severity", "fired_at");
CREATE INDEX "obs_alerts_service_name_fired_at_idx" ON "obs_alerts"("service_name", "fired_at");
CREATE INDEX "obs_alerts_correlation_id_idx" ON "obs_alerts"("correlation_id");

CREATE TABLE "obs_incidents" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "severity" "ObsIncidentSeverity" NOT NULL DEFAULT 'SEV3',
    "status" "ObsIncidentStatus" NOT NULL DEFAULT 'OPEN',
    "service_name" TEXT,
    "assignee_user_id" UUID,
    "reporter_user_id" UUID,
    "root_cause" TEXT,
    "postmortem" TEXT,
    "public_visible" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obs_incidents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_incidents_code_key" ON "obs_incidents"("code");
CREATE INDEX "obs_incidents_status_severity_started_at_idx" ON "obs_incidents"("status", "severity", "started_at");
CREATE INDEX "obs_incidents_service_name_started_at_idx" ON "obs_incidents"("service_name", "started_at");
CREATE INDEX "obs_incidents_public_visible_status_idx" ON "obs_incidents"("public_visible", "status");

CREATE TABLE "obs_incident_events" (
    "id" UUID NOT NULL,
    "incident_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actor_user_id" UUID,
    "metadata" JSONB,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_incident_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_incident_events_incident_id_occurred_at_idx" ON "obs_incident_events"("incident_id", "occurred_at");

CREATE TABLE "obs_slo_definitions" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "service_name" TEXT NOT NULL,
    "domain" "ObsServiceDomain" NOT NULL,
    "indicator_type" "ObsSloIndicatorType" NOT NULL,
    "target_percent" DOUBLE PRECISION NOT NULL,
    "latency_ms_target" DOUBLE PRECISION,
    "window_days" INTEGER NOT NULL DEFAULT 30,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obs_slo_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_slo_definitions_code_key" ON "obs_slo_definitions"("code");
CREATE INDEX "obs_slo_definitions_service_name_is_enabled_idx" ON "obs_slo_definitions"("service_name", "is_enabled");
CREATE INDEX "obs_slo_definitions_domain_is_enabled_idx" ON "obs_slo_definitions"("domain", "is_enabled");

CREATE TABLE "obs_sli_measurements" (
    "id" UUID NOT NULL,
    "slo_id" UUID NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "good_events" DOUBLE PRECISION NOT NULL,
    "total_events" DOUBLE PRECISION NOT NULL,
    "sli_percent" DOUBLE PRECISION NOT NULL,
    "error_budget_remaining" DOUBLE PRECISION NOT NULL,
    "reliability_score" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_sli_measurements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "obs_sli_measurements_slo_id_window_start_window_end_key" ON "obs_sli_measurements"("slo_id", "window_start", "window_end");
CREATE INDEX "obs_sli_measurements_window_start_idx" ON "obs_sli_measurements"("window_start");

CREATE TABLE "obs_capacity_samples" (
    "id" UUID NOT NULL,
    "service_name" TEXT NOT NULL,
    "domain" "ObsServiceDomain" NOT NULL DEFAULT 'INFRASTRUCTURE',
    "cpu_percent" DOUBLE PRECISION,
    "memory_percent" DOUBLE PRECISION,
    "disk_percent" DOUBLE PRECISION,
    "network_mbps" DOUBLE PRECISION,
    "db_growth_mb" DOUBLE PRECISION,
    "storage_growth_mb" DOUBLE PRECISION,
    "tx_throughput" DOUBLE PRECISION,
    "queue_depth" DOUBLE PRECISION,
    "forecast_load" DOUBLE PRECISION,
    "labels" JSONB,
    "observed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_capacity_samples_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_capacity_samples_service_name_observed_at_idx" ON "obs_capacity_samples"("service_name", "observed_at");
CREATE INDEX "obs_capacity_samples_domain_observed_at_idx" ON "obs_capacity_samples"("domain", "observed_at");

CREATE TABLE "obs_maintenance_notices" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "obs_maintenance_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_maintenance_notices_is_active_starts_at_idx" ON "obs_maintenance_notices"("is_active", "starts_at");

CREATE TABLE "obs_audit_records" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "details" JSONB,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "obs_audit_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "obs_audit_records_action_created_at_idx" ON "obs_audit_records"("action", "created_at");
CREATE INDEX "obs_audit_records_actor_user_id_created_at_idx" ON "obs_audit_records"("actor_user_id", "created_at");

ALTER TABLE "obs_metric_samples" ADD CONSTRAINT "obs_metric_samples_metric_id_fkey" FOREIGN KEY ("metric_id") REFERENCES "obs_metric_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obs_spans" ADD CONSTRAINT "obs_spans_trace_record_id_fkey" FOREIGN KEY ("trace_record_id") REFERENCES "obs_traces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obs_alerts" ADD CONSTRAINT "obs_alerts_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "obs_alert_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "obs_incident_events" ADD CONSTRAINT "obs_incident_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "obs_incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "obs_sli_measurements" ADD CONSTRAINT "obs_sli_measurements_slo_id_fkey" FOREIGN KEY ("slo_id") REFERENCES "obs_slo_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
