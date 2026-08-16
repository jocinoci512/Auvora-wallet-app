import { z } from 'zod';

/** Vercel / CI often inject empty strings for unset UI fields — treat as omitted. */
function emptyToUndefined(value: string | undefined): string | undefined {
  return value === '' ? undefined : value;
}

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Auvora Wallet'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_ADMIN_URL: z.string().url().optional(),
  NEXT_PUBLIC_DOCS_URL: z.string().url().optional(),
  NEXT_PUBLIC_STATUS_URL: z.string().url().optional(),
  NEXT_PUBLIC_MARKETING_URL: z.string().url().optional(),
  NEXT_PUBLIC_CDN_ASSET_BASE_URL: z.string().url().optional(),
  /** Public Reown/WalletConnect Project ID only — never a Reown Secret. */
  NEXT_PUBLIC_WC_PROJECT_ID: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse({
  NEXT_PUBLIC_API_URL: emptyToUndefined(process.env['NEXT_PUBLIC_API_URL']),
  NEXT_PUBLIC_APP_NAME: emptyToUndefined(process.env['NEXT_PUBLIC_APP_NAME']) ?? 'Auvora Wallet',
  NEXT_PUBLIC_APP_URL: emptyToUndefined(process.env['NEXT_PUBLIC_APP_URL']),
  NEXT_PUBLIC_ADMIN_URL: emptyToUndefined(process.env['NEXT_PUBLIC_ADMIN_URL']),
  NEXT_PUBLIC_DOCS_URL: emptyToUndefined(process.env['NEXT_PUBLIC_DOCS_URL']),
  NEXT_PUBLIC_STATUS_URL: emptyToUndefined(process.env['NEXT_PUBLIC_STATUS_URL']),
  NEXT_PUBLIC_MARKETING_URL: emptyToUndefined(process.env['NEXT_PUBLIC_MARKETING_URL']),
  NEXT_PUBLIC_CDN_ASSET_BASE_URL: emptyToUndefined(process.env['NEXT_PUBLIC_CDN_ASSET_BASE_URL']),
  NEXT_PUBLIC_WC_PROJECT_ID: emptyToUndefined(process.env['NEXT_PUBLIC_WC_PROJECT_ID']),
});
