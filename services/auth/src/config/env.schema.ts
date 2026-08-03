import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4001),
    SERVICE_NAME: z.string().default('auth'),
    SERVICE_VERSION: z.string().default('0.1.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    COOKIE_DOMAIN: z.string().optional(),
    CSRF_SECRET: z.string().min(32),
    LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOCKOUT_DURATION_SECONDS: z.coerce.number().int().positive().default(900),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    MAIL_DRIVER: z.enum(['console', 'smtp']).default('console'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email().optional(),
    APP_PUBLIC_URL: z.string().url(),
    NOTIFICATIONS_SERVICE_URL: z.string().url().optional(),
    ANALYTICS_SERVICE_URL: z.string().url().optional(),
    OBSERVABILITY_SERVICE_URL: z.string().url().optional(),
    INTERNAL_API_KEY: z.string().min(32).optional(),
    OTEL_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
    /** Non-production only: allow login before email verification (local Alpha). */
    AUTH_ALLOW_UNVERIFIED_LOGIN: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production',
      });
    }
    if (data.NODE_ENV === 'production' && data.AUTH_ALLOW_UNVERIFIED_LOGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_ALLOW_UNVERIFIED_LOGIN'],
        message: 'AUTH_ALLOW_UNVERIFIED_LOGIN must be false in production',
      });
    }
  });

export type ServiceEnv = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): ServiceEnv {
  // Monorepo root `.env` often sets PORT=4000 for the gateway. Prefer AUTH_PORT when present.
  const withDefaults: NodeJS.ProcessEnv = {
    ...source,
    PORT: source.AUTH_PORT ?? source.PORT ?? '4001',
    COOKIE_SECURE: source.COOKIE_SECURE ?? (source.NODE_ENV === 'production' ? 'true' : 'false'),
  };
  const parsed = envSchema.safeParse(withDefaults);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
