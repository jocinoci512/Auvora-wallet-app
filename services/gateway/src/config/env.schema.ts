import { z } from 'zod';
import { assertCredentialedCorsAllowlist, parseCorsOrigins } from '@auvora/security';

/** Railway / dashboards often set `VAR=""`; Zod treats that as present and skips defaults. */
function emptyToUndefined(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const serviceUrl = (fallback: string) =>
  z.preprocess(emptyToUndefined, z.string().url().default(fallback));

const DEV_CORS_DEFAULT = 'http://localhost:3000,http://localhost:3001';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Optional bind host. Leave unset on Railway so Nest binds dual-stack (IPv4+IPv6 private mesh). */
    HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    PORT: z.coerce.number().int().positive().default(4000),
    AUTH_SERVICE_URL: serviceUrl('http://127.0.0.1:4001'),
    WALLET_SERVICE_URL: serviceUrl('http://127.0.0.1:3002'),
    BLOCKCHAIN_SERVICE_URL: serviceUrl('http://127.0.0.1:3003'),
    PAYMENTS_SERVICE_URL: serviceUrl('http://127.0.0.1:3004'),
    COMPLIANCE_SERVICE_URL: serviceUrl('http://127.0.0.1:3005'),
    CUSTODY_SERVICE_URL: serviceUrl('http://127.0.0.1:3009'),
    NOTIFICATIONS_SERVICE_URL: serviceUrl('http://127.0.0.1:3006'),
    ANALYTICS_SERVICE_URL: serviceUrl('http://127.0.0.1:3007'),
    OBSERVABILITY_SERVICE_URL: serviceUrl('http://127.0.0.1:3010'),
    AI_SERVICE_URL: serviceUrl('http://127.0.0.1:3008'),
    MARKET_DATA_SERVICE_URL: serviceUrl('http://127.0.0.1:3012'),
    SWAP_SERVICE_URL: serviceUrl('http://127.0.0.1:3013'),
    NFT_SERVICE_URL: serviceUrl('http://127.0.0.1:3014'),
    STAKING_SERVICE_URL: serviceUrl('http://127.0.0.1:3015'),
    CONNECTIONS_SERVICE_URL: serviceUrl('http://127.0.0.1:3016'),
    BRIDGE_SERVICE_URL: serviceUrl('http://127.0.0.1:3017'),
    SERVICE_NAME: z.string().default('gateway'),
    SERVICE_VERSION: z.string().default('1.0.0-alpha.1'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: optionalUrl,
    REDIS_URL: optionalUrl,
    /** Required in production (no localhost default). Dev/test default to local web apps. */
    CORS_ORIGINS: z.preprocess(emptyToUndefined, z.string().optional()),
    OTEL_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
      emptyToUndefined,
      z.string().url().default('http://localhost:4318'),
    ),
    GATEWAY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    GATEWAY_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    /** When set (required in production), protects /metrics/resilience via x-internal-api-key. */
    INTERNAL_API_KEY: z.preprocess(emptyToUndefined, z.string().min(8).optional()),
  })
  .superRefine((data, ctx) => {
    const corsRaw =
      data.CORS_ORIGINS ?? (data.NODE_ENV === 'production' ? undefined : DEV_CORS_DEFAULT);

    if (data.NODE_ENV === 'production' && !corsRaw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message:
          'CORS_ORIGINS is required in production (e.g. https://auvorawallet.com,https://www.auvorawallet.com). Do not leave it empty or unset.',
      });
      return;
    }

    try {
      assertCredentialedCorsAllowlist(parseCorsOrigins(corsRaw), {
        nodeEnv: data.NODE_ENV,
      });
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: error instanceof Error ? error.message : 'Invalid CORS_ORIGINS',
      });
    }
  })
  .transform((data) => {
    const corsRaw = data.CORS_ORIGINS ?? (data.NODE_ENV === 'production' ? '' : DEV_CORS_DEFAULT);
    return {
      ...data,
      CORS_ORIGINS: assertCredentialedCorsAllowlist(parseCorsOrigins(corsRaw), {
        nodeEnv: data.NODE_ENV,
      }),
    };
  });

export type ServiceEnv = z.infer<typeof envSchema>;

/** Drop blank Railway/dashboard values so Zod defaults and `.optional()` work. */
export function sanitizeProcessEnv(source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const cleaned: NodeJS.ProcessEnv = { ...source };
  for (const [key, value] of Object.entries(cleaned)) {
    if (typeof value === 'string' && value.trim() === '') {
      delete cleaned[key];
    }
  }
  return cleaned;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {
  const parsed = envSchema.safeParse(sanitizeProcessEnv(source));
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  // Shared monorepo shells may set SERVICE_NAME for another package.
  return { ...parsed.data, SERVICE_NAME: 'gateway' };
}
