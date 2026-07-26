-- AlterTable: add originating-event linkage to notification_messages for cross-service traceability
ALTER TABLE "notification_messages" ADD COLUMN "source_event_type" TEXT;
ALTER TABLE "notification_messages" ADD COLUMN "source_event_id" TEXT;

-- Indexes
CREATE INDEX "notification_messages_source_event_type_created_at_idx" ON "notification_messages"("source_event_type", "created_at");
CREATE INDEX "notification_messages_correlation_id_idx" ON "notification_messages"("correlation_id");
