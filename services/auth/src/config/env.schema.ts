import { z } from 'zod';
import {
  isLocalDevOrigin,
  normalizeCorsOriginEntry,
  resolveCredentialedCorsOrigins,
} from '@auvora/security';

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
    /**
     * Prefer empty (host-only cookies on the API host).
     * Set only when auth cookies must be shared across subdomains (e.g. `.auvorawallet.com`).
     * Never set to `localhost` — browsers drop Domain=localhost.
     */
    COOKIE_DOMAIN: z.string().optional(),
    CSRF_SECRET: z.string().min(32),
    LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOCKOUT_DURATION_SECONDS: z.coerce.number().int().positive().default(900),
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    /** Stricter Redis limits for register/resend/forgot/reset mail flows. */
    MAIL_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
    MAIL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
    /**
     * console — local/dev only (never production).
     * smtp — nodemailer SMTP (Resend SMTP / SES SMTP / SendGrid SMTP, etc.).
     * notifications — route via notifications service internal API.
     */
    MAIL_DRIVER: z.enum(['console', 'smtp', 'notifications']).default('console'),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().email().optional(),
    /** Display name for From header, e.g. "Auvora Wallet". */
    SMTP_FROM_NAME: z.string().min(1).default('Auvora Wallet'),
    /** Canonical browser web origin for verify/reset links (not the API gateway). */
    APP_PUBLIC_URL: z.string().url(),
    /**
     * Optional extra browser origins for credentialed CORS (comma-separated).
     * Always merged with APP_PUBLIC_URL. Never `*`.
     * Prod example: https://www.auvorawallet.com (apex is APP_PUBLIC_URL).
     */
    CORS_ORIGINS: z.string().optional(),
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
    if (data.NODE_ENV === 'production' && data.MAIL_DRIVER === 'console') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MAIL_DRIVER'],
        message: 'MAIL_DRIVER=console is forbidden in production — configure smtp or notifications',
      });
    }
    if (data.MAIL_DRIVER === 'smtp') {
      if (!data.SMTP_HOST) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_HOST'],
          message: 'SMTP_HOST is required when MAIL_DRIVER=smtp',
        });
      }
      if (!data.SMTP_PORT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_PORT'],
          message: 'SMTP_PORT is required when MAIL_DRIVER=smtp',
        });
      }
      if (!data.SMTP_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SMTP_FROM'],
          message: 'SMTP_FROM is required when MAIL_DRIVER=smtp',
        });
      }
    }
    if (data.MAIL_DRIVER === 'notifications') {
      if (!data.NOTIFICATIONS_SERVICE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NOTIFICATIONS_SERVICE_URL'],
          message: 'NOTIFICATIONS_SERVICE_URL is required when MAIL_DRIVER=notifications',
        });
      }
      if (!data.INTERNAL_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['INTERNAL_API_KEY'],
          message: 'INTERNAL_API_KEY is required when MAIL_DRIVER=notifications',
        });
      }
    }
    if (data.NODE_ENV === 'production') {
      try {
        const publicOrigin = normalizeCorsOriginEntry(data.APP_PUBLIC_URL);
        if (isLocalDevOrigin(publicOrigin)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['APP_PUBLIC_URL'],
            message: 'APP_PUBLIC_URL must not be a localhost origin in production',
          });
        }
        if (!publicOrigin.startsWith('https://')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['APP_PUBLIC_URL'],
            message: 'APP_PUBLIC_URL must be https in production',
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['APP_PUBLIC_URL'],
          message: 'APP_PUBLIC_URL must be a valid absolute URL',
        });
      }
    }
    try {
      resolveCredentialedCorsOrigins({
        appPublicUrl: data.APP_PUBLIC_URL,
        corsOriginsCsv: data.CORS_ORIGINS,
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
    const corsOrigins = resolveCredentialedCorsOrigins({
      appPublicUrl: data.APP_PUBLIC_URL,
      corsOriginsCsv: data.CORS_ORIGINS,
      nodeEnv: data.NODE_ENV,
    });
    return { ...data, corsOrigins };
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
