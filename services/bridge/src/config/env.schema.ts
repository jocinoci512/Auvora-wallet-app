import { z } from 'zod';

const boolFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3017),
  SERVICE_NAME: z.string().default('bridge'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  BRIDGE_FIELD_ENCRYPTION_KEY: z.string().min(32),
  APP_PUBLIC_URL: z.string().url().optional(),
  BRIDGE_SIMULATOR_ENABLED: boolFlag('true'),
  BRIDGE_WORKERS_ENABLED: boolFlag('true'),
  BRIDGE_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  BRIDGE_QUOTE_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  BRIDGE_STATUS_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  BRIDGE_ROUTE_INTERVAL_MS: z.coerce.number().int().positive().default(90_000),
  BRIDGE_FEE_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  BRIDGE_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  BRIDGE_HEALTH_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  WALLET_SERVICE_URL: z.string().url().optional(),
  BLOCKCHAIN_SERVICE_URL: z.string().url().optional(),
  MARKET_DATA_SERVICE_URL: z.string().url().optional(),
  SWAP_SERVICE_URL: z.string().url().optional(),
  NFT_SERVICE_URL: z.string().url().optional(),
  STAKING_SERVICE_URL: z.string().url().optional(),
  CONNECTIONS_SERVICE_URL: z.string().url().optional(),
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

export type ServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return { ...parsed.data, SERVICE_NAME: 'bridge' };
}

export const ENV = Symbol('ENV');
