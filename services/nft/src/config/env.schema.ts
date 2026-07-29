import { z } from 'zod';

const boolFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3014),
  SERVICE_NAME: z.string().default('nft'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  NFT_FIELD_ENCRYPTION_KEY: z.string().min(32),
  APP_PUBLIC_URL: z.string().url().optional(),
  NFT_SIMULATOR_ENABLED: boolFlag('true'),
  NFT_WORKERS_ENABLED: boolFlag('true'),
  NFT_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  NFT_PROVIDER_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  NFT_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  NFT_METADATA_INTERVAL_MS: z.coerce.number().int().positive().default(45_000),
  NFT_MEDIA_CACHE_INTERVAL_MS: z.coerce.number().int().positive().default(90_000),
  NFT_OWNERSHIP_INTERVAL_MS: z.coerce.number().int().positive().default(120_000),
  NFT_COLLECTION_INTERVAL_MS: z.coerce.number().int().positive().default(180_000),
  NFT_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  NFT_METADATA_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  NFT_MEDIA_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  NFT_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  NFT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(90),
  MARKET_DATA_SERVICE_URL: z.string().url().optional(),
  BLOCKCHAIN_SERVICE_URL: z.string().url().optional(),
  WALLET_SERVICE_URL: z.string().url().optional(),
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
  return { ...parsed.data, SERVICE_NAME: 'nft' };
}

export const ENV = Symbol('ENV');
