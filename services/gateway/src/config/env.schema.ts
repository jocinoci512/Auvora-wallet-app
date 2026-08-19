import { z } from 'zod';
import { assertCredentialedCorsAllowlist, parseCorsOrigins } from '@auvora/security';

/** Railway / dashboards often set `VAR=""`; Zod treats that as present and skips defaults. */
function emptyToUndefined(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'string' && value.trim() === '') return undefined;
  return value;
}

const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

/** True when Railway left an empty private domain, e.g. `http://:3002`. */
export function isEmptyHostnameServiceUrl(value: string): boolean {
  const trimmed = value.trim();
  if (/^https?:\/\/:/i.test(trimmed)) return true;
  if (/:\/\/(undefined|null)(:|\/|$)/i.test(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return !parsed.hostname || parsed.hostname === 'undefined' || parsed.hostname === 'null';
  } catch {
    return false;
  }
}

/**
 * Validate an upstream base URL with Railway-aware error messages.
 * Hyphenated Railway service names must be quoted in template refs, e.g.
 * `http://${{ "market-data".RAILWAY_PRIVATE_DOMAIN }}:3012`
 */
export function assertServiceBaseUrl(varName: string, raw: string): string {
  const value = raw.trim();

  if (/\$\{\{/.test(value)) {
    throw new Error(
      `unresolved Railway template ${JSON.stringify(value)}. ` +
        `If the service name has a hyphen, quote it: ` +
        `\${{ "market-data".RAILWAY_PRIVATE_DOMAIN }}. ` +
        `Or delete ${varName} until that Railway service exists.`,
    );
  }

  if (isEmptyHostnameServiceUrl(value)) {
    throw new Error(
      `empty/invalid hostname in ${JSON.stringify(value)}. ` +
        `The Railway service reference did not resolve — create the target service ` +
        `(exact name match) or remove ${varName} until it exists.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(
      `Invalid url ${JSON.stringify(value)}. ` +
        `Expected http://\${{service.RAILWAY_PRIVATE_DOMAIN}}:<port> ` +
        `(quote hyphenated names: \${{ "market-data".RAILWAY_PRIVATE_DOMAIN }}).`,
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`URL must be http(s), got ${JSON.stringify(value)}`);
  }

  return value.replace(/\/$/, '');
}

/**
 * AUTH is required for Closed Beta.
 * Optional mesh upstreams default to loopback only in development/test so
 * local gateway can boot. Production never falls back to 127.0.0.1.
 */
type ServiceUrlMode = 'required' | 'optional';

const unresolvedUpstreamWarnings: string[] = [];

export function consumeUnresolvedUpstreamWarnings(): string[] {
  const copy = [...unresolvedUpstreamWarnings];
  unresolvedUpstreamWarnings.length = 0;
  return copy;
}

const LOCAL_UPSTREAM_DEFAULTS = {
  AUTH_SERVICE_URL: 'http://127.0.0.1:4001',
  WALLET_SERVICE_URL: 'http://127.0.0.1:3002',
  BLOCKCHAIN_SERVICE_URL: 'http://127.0.0.1:3003',
  PAYMENTS_SERVICE_URL: 'http://127.0.0.1:3004',
  COMPLIANCE_SERVICE_URL: 'http://127.0.0.1:3005',
  CUSTODY_SERVICE_URL: 'http://127.0.0.1:3009',
  NOTIFICATIONS_SERVICE_URL: 'http://127.0.0.1:3006',
  ANALYTICS_SERVICE_URL: 'http://127.0.0.1:3007',
  OBSERVABILITY_SERVICE_URL: 'http://127.0.0.1:3010',
  AI_SERVICE_URL: 'http://127.0.0.1:3008',
  MARKET_DATA_SERVICE_URL: 'http://127.0.0.1:3012',
  SWAP_SERVICE_URL: 'http://127.0.0.1:3013',
  NFT_SERVICE_URL: 'http://127.0.0.1:3014',
  STAKING_SERVICE_URL: 'http://127.0.0.1:3015',
  CONNECTIONS_SERVICE_URL: 'http://127.0.0.1:3016',
  BRIDGE_SERVICE_URL: 'http://127.0.0.1:3017',
} as const;

const serviceUrl = (varName: string, mode: ServiceUrlMode = 'optional') =>
  z
    .preprocess((value) => {
      const cleaned = emptyToUndefined(value);
      if (cleaned == null || typeof cleaned !== 'string') return cleaned;

      if (mode === 'optional' && (isEmptyHostnameServiceUrl(cleaned) || /\$\{\{/.test(cleaned))) {
        unresolvedUpstreamWarnings.push(
          `${varName}=${JSON.stringify(cleaned)} did not resolve; leaving unset (no loopback fallback)`,
        );
        return undefined;
      }
      return cleaned;
    }, z.string().optional())
    .superRefine((value, ctx) => {
      if (value == null || value === '') return;
      try {
        assertServiceBaseUrl(varName, value);
      } catch (error) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: error instanceof Error ? error.message : `Invalid ${varName}`,
        });
      }
    });

const DEV_CORS_DEFAULT = 'http://localhost:3000,http://localhost:3001';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    /** Optional bind host. Leave unset on Railway so Nest binds dual-stack (IPv4+IPv6 private mesh). */
    HOST: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    PORT: z.coerce.number().int().positive().default(4000),
    AUTH_SERVICE_URL: serviceUrl('AUTH_SERVICE_URL', 'required'),
    WALLET_SERVICE_URL: serviceUrl('WALLET_SERVICE_URL'),
    BLOCKCHAIN_SERVICE_URL: serviceUrl('BLOCKCHAIN_SERVICE_URL'),
    PAYMENTS_SERVICE_URL: serviceUrl('PAYMENTS_SERVICE_URL'),
    COMPLIANCE_SERVICE_URL: serviceUrl('COMPLIANCE_SERVICE_URL'),
    CUSTODY_SERVICE_URL: serviceUrl('CUSTODY_SERVICE_URL'),
    NOTIFICATIONS_SERVICE_URL: serviceUrl('NOTIFICATIONS_SERVICE_URL'),
    ANALYTICS_SERVICE_URL: serviceUrl('ANALYTICS_SERVICE_URL'),
    OBSERVABILITY_SERVICE_URL: serviceUrl('OBSERVABILITY_SERVICE_URL'),
    AI_SERVICE_URL: serviceUrl('AI_SERVICE_URL'),
    MARKET_DATA_SERVICE_URL: serviceUrl('MARKET_DATA_SERVICE_URL'),
    SWAP_SERVICE_URL: serviceUrl('SWAP_SERVICE_URL'),
    NFT_SERVICE_URL: serviceUrl('NFT_SERVICE_URL'),
    STAKING_SERVICE_URL: serviceUrl('STAKING_SERVICE_URL'),
    CONNECTIONS_SERVICE_URL: serviceUrl('CONNECTIONS_SERVICE_URL'),
    BRIDGE_SERVICE_URL: serviceUrl('BRIDGE_SERVICE_URL'),
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
    if (data.NODE_ENV === 'production' && !data.AUTH_SERVICE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_SERVICE_URL'],
        message: 'AUTH_SERVICE_URL is required in production (no 127.0.0.1 default).',
      });
    }

    const corsRaw =
      data.CORS_ORIGINS ?? (data.NODE_ENV === 'production' ? undefined : DEV_CORS_DEFAULT);

    if (data.NODE_ENV === 'production' && !corsRaw) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message:
          'CORS_ORIGINS is required in production (e.g. https://auvorawallet.com,https://www.auvorawallet.com,https://admin.auvorawallet.com). Do not leave it empty or unset.',
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
    const local = data.NODE_ENV !== 'production';
    const fill = (key: keyof typeof LOCAL_UPSTREAM_DEFAULTS, current: string | undefined) => {
      if (current) return current.replace(/\/$/, '');
      return local ? LOCAL_UPSTREAM_DEFAULTS[key] : undefined;
    };
    const auth =
      data.AUTH_SERVICE_URL?.replace(/\/$/, '') ??
      (local ? LOCAL_UPSTREAM_DEFAULTS.AUTH_SERVICE_URL : undefined);
    return {
      ...data,
      AUTH_SERVICE_URL: auth as string,
      WALLET_SERVICE_URL: fill('WALLET_SERVICE_URL', data.WALLET_SERVICE_URL),
      BLOCKCHAIN_SERVICE_URL: fill('BLOCKCHAIN_SERVICE_URL', data.BLOCKCHAIN_SERVICE_URL),
      PAYMENTS_SERVICE_URL: fill('PAYMENTS_SERVICE_URL', data.PAYMENTS_SERVICE_URL),
      COMPLIANCE_SERVICE_URL: fill('COMPLIANCE_SERVICE_URL', data.COMPLIANCE_SERVICE_URL),
      CUSTODY_SERVICE_URL: fill('CUSTODY_SERVICE_URL', data.CUSTODY_SERVICE_URL),
      NOTIFICATIONS_SERVICE_URL: fill('NOTIFICATIONS_SERVICE_URL', data.NOTIFICATIONS_SERVICE_URL),
      ANALYTICS_SERVICE_URL: fill('ANALYTICS_SERVICE_URL', data.ANALYTICS_SERVICE_URL),
      OBSERVABILITY_SERVICE_URL: fill('OBSERVABILITY_SERVICE_URL', data.OBSERVABILITY_SERVICE_URL),
      AI_SERVICE_URL: fill('AI_SERVICE_URL', data.AI_SERVICE_URL),
      MARKET_DATA_SERVICE_URL: fill('MARKET_DATA_SERVICE_URL', data.MARKET_DATA_SERVICE_URL),
      SWAP_SERVICE_URL: fill('SWAP_SERVICE_URL', data.SWAP_SERVICE_URL),
      NFT_SERVICE_URL: fill('NFT_SERVICE_URL', data.NFT_SERVICE_URL),
      STAKING_SERVICE_URL: fill('STAKING_SERVICE_URL', data.STAKING_SERVICE_URL),
      CONNECTIONS_SERVICE_URL: fill('CONNECTIONS_SERVICE_URL', data.CONNECTIONS_SERVICE_URL),
      BRIDGE_SERVICE_URL: fill('BRIDGE_SERVICE_URL', data.BRIDGE_SERVICE_URL),
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
  unresolvedUpstreamWarnings.length = 0;
  const parsed = envSchema.safeParse(sanitizeProcessEnv(source));
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  for (const warning of unresolvedUpstreamWarnings) {
    console.warn(`[gateway] ${warning}`);
  }

  // Shared monorepo shells may set SERVICE_NAME for another package.
  return { ...parsed.data, SERVICE_NAME: 'gateway' };
}
