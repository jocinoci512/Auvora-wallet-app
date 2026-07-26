import { z } from 'zod';

const boolFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3010),
  SERVICE_NAME: z.string().default('observability'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  OBSERVABILITY_FIELD_ENCRYPTION_KEY: z.string().min(32),
  APP_PUBLIC_URL: z.string().url().optional(),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  OBSERVABILITY_ALERT_WORKER_ENABLED: boolFlag('true'),
  OBSERVABILITY_ALERT_POLL_MS: z.coerce.number().int().positive().default(10_000),
  OBSERVABILITY_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  OBSERVABILITY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(240),
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
  return { ...parsed.data, SERVICE_NAME: 'observability' };
}

export const ENV = Symbol('ENV');
