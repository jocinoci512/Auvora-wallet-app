import { ForbiddenException } from '@nestjs/common';
import type { ServiceEnv } from '../../config/env.schema';

const PRODUCTION_DB_MARKERS = [
  'amazonaws.com',
  'rds.amazonaws',
  'neon.tech',
  'supabase.co',
  'planetscale',
  'azure.com',
  'cloud.google',
];

const PRODUCTION_SMTP_MARKERS = ['sendgrid', 'mailgun', 'ses.amazonaws', 'postmark', 'resend.com'];

/** LOCAL QA ONLY — refuses production-like targets. */
export function assertQaEmailReplayAllowed(env: ServiceEnv): void {
  if (!env.AUVORA_QA_ALLOW_EMAIL_REPLAY) {
    throw new ForbiddenException('AUVORA_QA_ALLOW_EMAIL_REPLAY is not enabled');
  }
  if (env.NODE_ENV === 'production') {
    throw new ForbiddenException('QA email replay is disabled in production');
  }
  const db = env.DATABASE_URL.toLowerCase();
  if (PRODUCTION_DB_MARKERS.some((marker) => db.includes(marker))) {
    throw new ForbiddenException('QA email replay refused — production database host detected');
  }
  const emailUrl = (env.NOTIFICATIONS_EMAIL_PROVIDER_URL ?? '').toLowerCase();
  if (!emailUrl) {
    throw new ForbiddenException('QA email replay requires local Mailpit bridge URL');
  }
  if (!emailUrl.includes('127.0.0.1') && !emailUrl.includes('localhost')) {
    throw new ForbiddenException('QA email replay refused — email provider is not local Mailpit');
  }
  if (PRODUCTION_SMTP_MARKERS.some((marker) => emailUrl.includes(marker))) {
    throw new ForbiddenException('QA email replay refused — production SMTP provider detected');
  }
}
