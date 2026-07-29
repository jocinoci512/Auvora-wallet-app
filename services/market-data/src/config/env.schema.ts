import { z } from 'zod';

const boolFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3012),
  SERVICE_NAME: z.string().default('market-data'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  MARKET_DATA_FIELD_ENCRYPTION_KEY: z.string().min(32),
  APP_PUBLIC_URL: z.string().url().optional(),
  COINGECKO_API_KEY: z.string().optional(),
  COINGECKO_BASE_URL: z.string().url().default('https://api.coingecko.com/api/v3'),
  MARKET_DATA_SIMULATOR_ENABLED: boolFlag('true'),
  MARKET_DATA_WORKERS_ENABLED: boolFlag('true'),
  MARKET_DATA_PRICE_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  MARKET_DATA_METADATA_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),
  MARKET_DATA_PORTFOLIO_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  MARKET_DATA_CACHE_INTERVAL_MS: z.coerce.number().int().positive().default(45_000),
  MARKET_DATA_HISTORY_INTERVAL_MS: z.coerce.number().int().positive().default(120_000),
  MARKET_DATA_ALERT_INTERVAL_MS: z.coerce.number().int().positive().default(15_000),
  MARKET_DATA_PRICE_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  MARKET_DATA_METADATA_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  MARKET_DATA_PORTFOLIO_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  MARKET_DATA_TRENDING_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(120),
  MARKET_DATA_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  MARKET_DATA_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  NOTIFICATIONS_SERVICE_URL: z.string().url().optional(),
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  WALLET_SERVICE_URL: z.string().url().optional(),
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
  return { ...parsed.data, SERVICE_NAME: 'market-data' };
}

export const ENV = Symbol('ENV');
