import { formatApiError } from './api-client';

export const ADMIN_TOTP_ISSUER = 'Auvora Wallet';
export const ADMIN_TOTP_ACCOUNT_LABEL = 'Admin';

/** Display otpauth URI for Google Authenticator. Secret stays in memory only. */
export function buildAdminOtpauthUrl(secret: string): string {
  const issuer = encodeURIComponent(ADMIN_TOTP_ISSUER);
  const account = encodeURIComponent(ADMIN_TOTP_ACCOUNT_LABEL);
  const cleaned = secret.replace(/\s+/g, '').toUpperCase();
  return `otpauth://totp/${issuer}:${account}?secret=${cleaned}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function normalizeTotpInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export function formatMfaAuthError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  const message = formatApiError(error);
  if (status === 429 || /too many/i.test(message)) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (/expired/i.test(message)) {
    return 'This sign-in step expired. Return to sign in and try again.';
  }
  if (status === 403) {
    return 'You cannot complete this administrator sign-in.';
  }
  if (/recovery/i.test(message)) {
    return 'That recovery code is not valid. Each code can only be used once.';
  }
  if (status === 401 || /invalid/i.test(message)) {
    return 'The code is incorrect or has expired. Enter the latest code from your authenticator app.';
  }
  return 'Verification could not be completed. Enter the latest code from your authenticator app.';
}

export function recoveryCodesText(codes: string[]): string {
  return [
    'Auvora Wallet Admin recovery codes',
    'Save these offline. Each code can be used once.',
    '',
    ...codes,
    '',
  ].join('\n');
}
