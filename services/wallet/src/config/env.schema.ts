import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3002),
  SERVICE_NAME: z.string().default('wallet'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  APP_PUBLIC_URL: z.string().url().optional(),
  /**
   * Optional. When set, `BlockchainHttpClientAdapter` calls the blockchain
   * service (Phase 4, system of record for chain addresses) for address
   * validation instead of relying only on the local regex stubs in
   * `infrastructure/blockchain/blockchain-providers.ts`.
   */
  BLOCKCHAIN_SERVICE_URL: z.string().url().optional(),
  BLOCKCHAIN_HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  /** Background wallet workers (sync/balance/portfolio/retry/health). */
  WALLET_WORKERS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  WALLET_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  WALLET_BALANCE_INTERVAL_MS: z.coerce.number().int().positive().default(45_000),
  WALLET_PORTFOLIO_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  WALLET_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(20_000),
  WALLET_HEALTH_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  /** Optional. When set with INTERNAL_API_KEY, NotificationsPublisherAdapter forwards completed-transfer events for downstream webhook/notification fan-out. */
  NOTIFICATIONS_SERVICE_URL: z.string().url().optional(),
  /** Optional. When set with INTERNAL_API_KEY, AiPublisherAdapter forwards domain events to the AI platform. */
  AI_SERVICE_URL: z.string().url().optional(),
  /** Optional. When set with INTERNAL_API_KEY, AnalyticsPublisherAdapter forwards domain events to the analytics platform. */
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  OBSERVABILITY_SERVICE_URL: z.string().url().optional(),
  /** Optional. When set with INTERNAL_API_KEY, portfolio fiat valuation uses market-data internal APIs. */
  MARKET_DATA_SERVICE_URL: z.string().url().optional(),
  INTERNAL_API_KEY: z.string().min(32),
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
  return parsed.data;
}

export const ENV = Symbol('ENV');
