import { formatApiError } from '../api-client';

export type AuthIssue =
  | 'invalid_email'
  | 'weak_password'
  | 'duplicate'
  | 'invalid_credentials'
  | 'unverified'
  | 'locked'
  | 'suspended'
  | 'expired'
  | 'revoked'
  | 'rate_limited'
  | 'offline'
  | 'backend'
  | 'unknown';

export function classifyAuthError(raw: string): AuthIssue {
  const t = raw.toLowerCase();
  if (/invalid email|email.*invalid|malformed email/.test(t)) return 'invalid_email';
  if (/password.*(weak|short|complexity|12)|upper.*lower.*digit/.test(t)) return 'weak_password';
  if (/409|already exists|duplicate|taken/.test(t)) return 'duplicate';
  if (/401|invalid credentials|incorrect password|unauthorized/.test(t))
    return 'invalid_credentials';
  if (/verif/.test(t)) return 'unverified';
  if (/locked|too many failed/.test(t)) return 'locked';
  if (/suspend/.test(t)) return 'suspended';
  if (/expired|jwt expired|session expired/.test(t)) return 'expired';
  if (/revok|forced logout/.test(t)) return 'revoked';
  if (/429|rate.?limit|too many/.test(t)) return 'rate_limited';
  if (/failed to fetch|networkerror|offline|econnrefused/.test(t)) return 'offline';
  if (/500|503|gateway|unavailable/.test(t)) return 'backend';
  return 'unknown';
}

export function humanizeAuthError(
  error: unknown,
  fallback = 'Sign-in could not be completed.',
): string {
  const raw = formatApiError(error);
  switch (classifyAuthError(raw)) {
    case 'invalid_email':
      return 'Enter a valid email address.';
    case 'weak_password':
      return 'Use at least 12 characters, including upper and lower case, a number, and a symbol.';
    case 'duplicate':
      return 'An account with this email already exists. Sign in, or reset your password.';
    case 'invalid_credentials':
      return 'Email or password is incorrect.';
    case 'unverified':
      return 'Verify your email before signing in. You can resend the verification message below.';
    case 'locked':
      return 'This account is temporarily locked after too many attempts. Wait a few minutes, or reset your password.';
    case 'suspended':
      return 'This account is suspended. Contact support@auvorawallet.com if you need help.';
    case 'expired':
      return 'Your session expired. Sign in again. Your wallet keys stay on this device.';
    case 'revoked':
      return 'This session was signed out. Sign in again to continue.';
    case 'rate_limited':
      return 'Too many attempts. Wait a minute, then try again.';
    case 'offline':
      return 'You appear to be offline. Check your connection and retry.';
    case 'backend':
      return 'Account services are unavailable right now. Your wallet on this device is unchanged.';
    default:
      if (raw.length > 140 || /[{[]/.test(raw)) return fallback;
      return raw || fallback;
  }
}

export function isStrongPassword(value: string): boolean {
  return (
    value.length >= 12 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
