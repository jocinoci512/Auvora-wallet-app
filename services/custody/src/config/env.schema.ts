import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3009),
  SERVICE_NAME: z.string().default('custody'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  /** Optional. When set with INTERNAL_API_KEY, NotificationsPublisherAdapter forwards completed signing/custody events for downstream webhook/notification fan-out. */
  NOTIFICATIONS_SERVICE_URL: z.string().url().optional(),
  /** Optional. When set with INTERNAL_API_KEY, AiPublisherAdapter forwards domain events to the AI platform. */
  AI_SERVICE_URL: z.string().url().optional(),
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  OBSERVABILITY_SERVICE_URL: z.string().url().optional(),
  CUSTODY_FIELD_ENCRYPTION_KEY: z.string().min(32),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  APP_PUBLIC_URL: z.string().url().optional(),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  CUSTODY_SIMULATOR_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
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
  if (parsed.data.NODE_ENV === 'production' && parsed.data.CUSTODY_SIMULATOR_ENABLED) {
    throw new Error('CUSTODY_SIMULATOR_ENABLED must be false in production');
  }
  return { ...parsed.data, SERVICE_NAME: 'custody' };
}

export const ENV = Symbol('ENV');
