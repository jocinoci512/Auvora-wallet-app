import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3003),
  SERVICE_NAME: z.string().default('blockchain'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  APP_PUBLIC_URL: z.string().url().optional(),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  BLOCKCHAIN_SIMULATOR_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /**
   * Primary blockchain infrastructure mode.
   * - `alchemy` (default): use Alchemy for ETH/POLYGON/BSC/SOL/TRON/BTC when credentials exist
   * - `simulator`: force local simulators even if Alchemy env is present
   */
  BLOCKCHAIN_PRIMARY_PROVIDER: z.enum(['alchemy', 'simulator']).default('alchemy'),
  BLOCKCHAIN_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  /** Alchemy API key — used to construct per-chain RPC URLs when explicit URLs are unset. */
  ALCHEMY_API_KEY: z.string().min(1).optional(),
  ALCHEMY_ETHEREUM_RPC_URL: z.string().url().optional(),
  ALCHEMY_POLYGON_RPC_URL: z.string().url().optional(),
  ALCHEMY_BSC_RPC_URL: z.string().url().optional(),
  ALCHEMY_SOLANA_RPC_URL: z.string().url().optional(),
  ALCHEMY_TRON_RPC_URL: z.string().url().optional(),
  ALCHEMY_BITCOIN_RPC_URL: z.string().url().optional(),
  ALCHEMY_RPC_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  /** Fail boot when Alchemy is primary but credentials are missing (default true in production). */
  ALCHEMY_REQUIRED: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  CUSTODY_SERVICE_URL: z.string().url().optional(),
  /** Optional. When set with INTERNAL_API_KEY, NotificationsPublisherAdapter forwards confirmed-transaction events for downstream webhook/notification fan-out. */
  NOTIFICATIONS_SERVICE_URL: z.string().url().optional(),
  /** Optional. When set with INTERNAL_API_KEY, AiPublisherAdapter forwards domain events to the AI platform. */
  AI_SERVICE_URL: z.string().url().optional(),
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  OBSERVABILITY_SERVICE_URL: z.string().url().optional(),
  INTERNAL_API_KEY: z.string().min(32).optional(),
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
  if (parsed.data.NODE_ENV === 'production' && parsed.data.BLOCKCHAIN_SIMULATOR_ENABLED) {
    throw new Error('BLOCKCHAIN_SIMULATOR_ENABLED must be false in production');
  }

  const hasAlchemy =
    Boolean(parsed.data.ALCHEMY_API_KEY) ||
    Boolean(parsed.data.ALCHEMY_ETHEREUM_RPC_URL) ||
    Boolean(parsed.data.ALCHEMY_POLYGON_RPC_URL) ||
    Boolean(parsed.data.ALCHEMY_BSC_RPC_URL) ||
    Boolean(parsed.data.ALCHEMY_SOLANA_RPC_URL) ||
    Boolean(parsed.data.ALCHEMY_TRON_RPC_URL) ||
    Boolean(parsed.data.ALCHEMY_BITCOIN_RPC_URL);

  const alchemyRequired =
    parsed.data.ALCHEMY_REQUIRED ??
    (parsed.data.NODE_ENV === 'production' &&
      parsed.data.BLOCKCHAIN_PRIMARY_PROVIDER === 'alchemy');

  if (alchemyRequired && !hasAlchemy) {
    throw new Error(
      'Alchemy is required (ALCHEMY_REQUIRED / production primary) but ALCHEMY_API_KEY / ALCHEMY_*_RPC_URL are missing',
    );
  }

  if (
    parsed.data.BLOCKCHAIN_PRIMARY_PROVIDER === 'alchemy' &&
    !hasAlchemy &&
    parsed.data.NODE_ENV !== 'test'
  ) {
    console.warn(
      '[blockchain] BLOCKCHAIN_PRIMARY_PROVIDER=alchemy but no Alchemy credentials — simulators remain until ALCHEMY_API_KEY is set',
    );
  }

  return parsed.data;
}

export const ENV = Symbol('ENV');
