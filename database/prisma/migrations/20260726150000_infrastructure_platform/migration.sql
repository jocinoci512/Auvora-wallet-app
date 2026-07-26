-- Phase 12: Infrastructure Platform / Secrets Data Plane

CREATE TYPE "InfraEnvironmentCode" AS ENUM ('LOCAL', 'DEVELOPMENT', 'QA', 'TESTING', 'STAGING', 'PRODUCTION', 'DISASTER_RECOVERY');
CREATE TYPE "InfraDeploymentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "InfraBackupStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'VERIFIED');
CREATE TYPE "InfraComponentKind" AS ENUM ('SERVICE', 'DATABASE', 'REDIS', 'STORAGE', 'CLUSTER', 'INGRESS');
CREATE TYPE "InfraDeploymentStrategy" AS ENUM ('BLUE_GREEN', 'CANARY', 'ROLLING');

CREATE TABLE "infra_environments" (
    "id" UUID NOT NULL,
    "code" "InfraEnvironmentCode" NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "infra_environments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "infra_environments_code_key" ON "infra_environments"("code");

CREATE TABLE "infra_deployments" (
    "id" UUID NOT NULL,
    "environment_code" "InfraEnvironmentCode" NOT NULL,
    "version" TEXT NOT NULL,
    "strategy" "InfraDeploymentStrategy" NOT NULL,
    "status" "InfraDeploymentStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "actor_user_id" UUID,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "infra_deployments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "infra_deployments_environment_code_started_at_idx" ON "infra_deployments"("environment_code", "started_at");
CREATE INDEX "infra_deployments_status_started_at_idx" ON "infra_deployments"("status", "started_at");

CREATE TABLE "infra_backup_jobs" (
    "id" UUID NOT NULL,
    "environment_code" "InfraEnvironmentCode" NOT NULL,
    "component_kind" "InfraComponentKind" NOT NULL,
    "component_name" TEXT NOT NULL,
    "status" "InfraBackupStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "location" TEXT,
    "checksum" TEXT,
    "verified_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "infra_backup_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "infra_backup_jobs_environment_code_started_at_idx" ON "infra_backup_jobs"("environment_code", "started_at");
CREATE INDEX "infra_backup_jobs_status_started_at_idx" ON "infra_backup_jobs"("status", "started_at");

CREATE TABLE "infra_recovery_drills" (
    "id" UUID NOT NULL,
    "environment_code" "InfraEnvironmentCode" NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InfraDeploymentStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "rto_minutes" INTEGER,
    "rpo_minutes" INTEGER,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "infra_recovery_drills_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "infra_recovery_drills_environment_code_started_at_idx" ON "infra_recovery_drills"("environment_code", "started_at");
CREATE INDEX "infra_recovery_drills_status_started_at_idx" ON "infra_recovery_drills"("status", "started_at");

CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "environment_code" "InfraEnvironmentCode",
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "feature_flags_code_key" ON "feature_flags"("code");
CREATE INDEX "feature_flags_environment_code_enabled_idx" ON "feature_flags"("environment_code", "enabled");

CREATE TABLE "infra_audit_records" (
    "id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" UUID,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "infra_audit_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "infra_audit_records_action_created_at_idx" ON "infra_audit_records"("action", "created_at");
CREATE INDEX "infra_audit_records_actor_user_id_created_at_idx" ON "infra_audit_records"("actor_user_id", "created_at");
