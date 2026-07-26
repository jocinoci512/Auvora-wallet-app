import { z } from 'zod';

const boolFlag = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3008),
  SERVICE_NAME: z.string().default('ai'),
  SERVICE_VERSION: z.string().default('0.1.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  AI_FIELD_ENCRYPTION_KEY: z.string().min(32),
  APP_PUBLIC_URL: z.string().url().optional(),
  OTEL_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),

  AI_SIMULATOR_ENABLED: boolFlag('true'),
  AI_DEFAULT_PROVIDER_CODE: z.string().default('sim-default'),
  AI_CACHE_TTL_SECONDS: z.coerce.number().int().nonnegative().default(120),
  AI_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),

  AI_OPENAI_API_KEY: z.string().optional(),
  AI_OPENAI_BASE_URL: z.string().url().optional(),
  AI_ANTHROPIC_API_KEY: z.string().optional(),
  AI_GEMINI_API_KEY: z.string().optional(),
  AI_AZURE_OPENAI_API_KEY: z.string().optional(),
  AI_AZURE_OPENAI_BASE_URL: z.string().url().optional(),
  AI_AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  AI_LOCAL_LLM_BASE_URL: z.string().url().optional(),
  AI_LOCAL_LLM_API_KEY: z.string().optional(),
  ANALYTICS_SERVICE_URL: z.string().url().optional(),
  OBSERVABILITY_SERVICE_URL: z.string().url().optional(),
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
  if (parsed.data.NODE_ENV === 'production' && parsed.data.AI_SIMULATOR_ENABLED) {
    throw new Error('AI_SIMULATOR_ENABLED must be false in production');
  }
  return { ...parsed.data, SERVICE_NAME: 'ai' };
}

export const ENV = Symbol('ENV');
