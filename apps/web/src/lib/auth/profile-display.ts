/** Canonical account label for header/sidebar — never show generic placeholders when profile exists. */

import type { AuthUser } from './session';

const GENERIC_DISPLAY_NAMES = new Set(['auvora user', 'auvora', 'user']);

export function isGenericDisplayName(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return GENERIC_DISPLAY_NAMES.has(value.trim().toLowerCase());
}

/** Prefer username, then real name, then email local-part, then full email. */
export function formatAccountLabel(user: AuthUser | null | undefined): string {
  if (!user) return 'Sign in';
  const username = user.username?.trim();
  if (username) return username;
  const display = user.displayName?.trim();
  if (display && !isGenericDisplayName(display)) return display;
  const email = user.email?.trim();
  if (email?.includes('@')) {
    const local = email.split('@')[0]?.trim();
    if (local) return local;
  }
  return email || 'Account';
}

export function profileLoadingLabel(user: AuthUser | null, loading: boolean): string {
  if (loading && !user?.username && !user?.email) return 'Loading…';
  return formatAccountLabel(user);
}
