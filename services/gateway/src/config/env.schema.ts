import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  AUTH_SERVICE_URL: z.string().url().default('http://127.0.0.1:4001'),
  WALLET_SERVICE_URL: z.string().url().default('http://127.0.0.1:3002'),
  BLOCKCHAIN_SERVICE_URL: z.string().url().default('http://127.0.0.1:3003'),
  PAYMENTS_SERVICE_URL: z.string().url().default('http://127.0.0.1:3004'),
  COMPLIANCE_SERVICE_URL: z.string().url().default('http://127.0.0.1:3005'),
  CUSTODY_SERVICE_URL: z.string().url().default('http://127.0.0.1:3009'),
  NOTIFICATIONS_SERVICE_URL: z.string().url().default('http://127.0.0.1:3006'),
  ANALYTICS_SERVICE_URL: z.string().url().default('http://127.0.0.1:3007'),
  OBSERVABILITY_SERVICE_URL: z.string().url().default('http://127.0.0.1:3010'),
  AI_SERVICE_URL: z.string().url().default('http://127.0.0.1:3008'),
  MARKET_DATA_SERVICE_URL: z.string().url().default('http://127.0.0.1:3012'),
  SWAP_SERVICE_URL: z.string().url().default('http://127.0.0.1:3013'),
  NFT_SERVICE_URL: z.string().url().default('http://127.0.0.1:3014'),
  STAKING_SERVICE_URL: z.string().url().default('http://127.0.0.1:3015'),
  CONNECTIONS_SERVICE_URL: z.string().url().default('http://127.0.0.1:3016'),
  BRIDGE_SERVICE_URL: z.string().url().default('http://127.0.0.1:3017'),
  SERVICE_NAME: z.string().default('gateway'),
  SERVICE_VERSION: z.string().default('1.0.0-alpha.1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  GATEWAY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  GATEWAY_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  /** When set (required in production), protects /metrics/resilience via x-internal-api-key. */
  INTERNAL_API_KEY: z.string().min(8).optional(),
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
  // Shared monorepo shells may set SERVICE_NAME for another package.
  return { ...parsed.data, SERVICE_NAME: 'gateway' };
}
