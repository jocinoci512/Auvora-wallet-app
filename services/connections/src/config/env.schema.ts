import { z } from 'zod';

const boolFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3016),
  SERVICE_NAME: z.string().default('connections'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  CONNECTIONS_FIELD_ENCRYPTION_KEY: z.string().min(32),
  APP_PUBLIC_URL: z.string().url().optional(),
  CONNECTIONS_SIMULATOR_ENABLED: boolFlag('true'),
  CONNECTIONS_WORKERS_ENABLED: boolFlag('true'),
  CONNECTIONS_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  CONNECTIONS_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  CONNECTIONS_SIGN_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  CONNECTIONS_MONITOR_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  CONNECTIONS_SESSION_INTERVAL_MS: z.coerce.number().int().positive().default(45_000),
  CONNECTIONS_DEVICE_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  CONNECTIONS_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(90_000),
  CONNECTIONS_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  CONNECTIONS_HEALTH_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  CONNECTIONS_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  CONNECTIONS_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  WALLET_SERVICE_URL: z.string().url().optional(),
  BLOCKCHAIN_SERVICE_URL: z.string().url().optional(),
  NFT_SERVICE_URL: z.string().url().optional(),
  MARKET_DATA_SERVICE_URL: z.string().url().optional(),
  SWAP_SERVICE_URL: z.string().url().optional(),
  STAKING_SERVICE_URL: z.string().url().optional(),
  NOTIFICATIONS_SERVICE_URL: z.string().url().optional(),
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  AI_SERVICE_URL: z.string().url().optional(),
  OBSERVABILITY_SERVICE_URL: z.string().url().optional(),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
});

const envSchemaChecked = envSchema.superRefine((data, ctx) => {
  // Never allow the simulator/fake connection provider in production.
  if (data.NODE_ENV === 'production' && data.CONNECTIONS_SIMULATOR_ENABLED) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CONNECTIONS_SIMULATOR_ENABLED'],
      message: 'CONNECTIONS_SIMULATOR_ENABLED must be false when NODE_ENV=production',
    });
  }
});

export type ServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {
  const parsed = envSchemaChecked.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return { ...parsed.data, SERVICE_NAME: 'connections' };
}

export const ENV = Symbol('ENV');
