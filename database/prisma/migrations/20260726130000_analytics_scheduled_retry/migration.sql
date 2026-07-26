-- Scheduled report retry fields

ALTER TABLE "scheduled_reports" ADD COLUMN "attempt_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "scheduled_reports" ADD COLUMN "max_attempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "scheduled_reports" ADD COLUMN "last_error" TEXT;
ALTER TABLE "scheduled_reports" ADD COLUMN "next_attempt_at" TIMESTAMP(3);

CREATE INDEX "scheduled_reports_status_next_attempt_at_idx" ON "scheduled_reports"("status", "next_attempt_at");
