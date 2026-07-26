import { z } from 'zod';

const boolFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3006),
  SERVICE_NAME: z.string().default('notifications'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  /** Optional. When set with INTERNAL_API_KEY, AiPublisherAdapter forwards domain events to the AI platform. */
  AI_SERVICE_URL: z.string().url().optional(),
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  OBSERVABILITY_SERVICE_URL: z.string().url().optional(),
  NOTIFICATIONS_FIELD_ENCRYPTION_KEY: z.string().min(32),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  APP_PUBLIC_URL: z.string().url().optional(),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  NOTIFICATIONS_SIMULATOR_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  NOTIFICATIONS_QUEUE_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2_000),
  NOTIFICATIONS_QUEUE_WORKER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // Per-channel kill switches â€” evaluated before the DB-backed provider table so an operator
  // can hard-disable a channel via env even if enabled rows still exist.
  NOTIFICATIONS_CHANNEL_EMAIL_ENABLED: boolFlag('true'),
  NOTIFICATIONS_CHANNEL_SMS_ENABLED: boolFlag('true'),
  NOTIFICATIONS_CHANNEL_PUSH_ENABLED: boolFlag('true'),
  NOTIFICATIONS_CHANNEL_IN_APP_ENABLED: boolFlag('true'),
  NOTIFICATIONS_CHANNEL_BROWSER_ENABLED: boolFlag('true'),
  NOTIFICATIONS_CHANNEL_WEBHOOK_ENABLED: boolFlag('true'),
  NOTIFICATIONS_CHANNEL_SLACK_ENABLED: boolFlag('true'),
  NOTIFICATIONS_CHANNEL_TEAMS_ENABLED: boolFlag('true'),

  // Real backend HTTP providers. Only used when NOTIFICATIONS_SIMULATOR_ENABLED is false; a
  // channel without a configured URL falls back to a local no-op (IN_APP/BROWSER/WEBHOOK) or
  // UnavailableChannelProvider (EMAIL/SMS/PUSH/SLACK/TEAMS).
  NOTIFICATIONS_EMAIL_PROVIDER_URL: z.string().url().optional(),
  NOTIFICATIONS_EMAIL_PROVIDER_TOKEN: z.string().optional(),
  NOTIFICATIONS_SMS_PROVIDER_URL: z.string().url().optional(),
  NOTIFICATIONS_SMS_PROVIDER_TOKEN: z.string().optional(),
  NOTIFICATIONS_PUSH_PROVIDER_URL: z.string().url().optional(),
  NOTIFICATIONS_PUSH_PROVIDER_TOKEN: z.string().optional(),
  NOTIFICATIONS_SLACK_PROVIDER_URL: z.string().url().optional(),
  NOTIFICATIONS_SLACK_PROVIDER_TOKEN: z.string().optional(),
  NOTIFICATIONS_TEAMS_PROVIDER_URL: z.string().url().optional(),
  NOTIFICATIONS_TEAMS_PROVIDER_TOKEN: z.string().optional(),

  NOTIFICATIONS_WEBHOOK_WORKER_ENABLED: boolFlag('true'),
});

export type ServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.NOTIFICATIONS_SIMULATOR_ENABLED) {
    throw new Error('NOTIFICATIONS_SIMULATOR_ENABLED must be false in production');
  }
  return { ...parsed.data, SERVICE_NAME: 'notifications' };
}

export const ENV = Symbol('ENV');
