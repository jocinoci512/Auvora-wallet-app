-- AlterEnum: complete acceptance audit actions used by internal acceptance runner
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCEPTANCE_EMAIL_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCEPTANCE_USER_CLEANUP';
