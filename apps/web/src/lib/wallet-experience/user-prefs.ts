/** Client preferences captured during onboarding (optional, local). */

const KEY = 'auvora_user_prefs_v1';

export type ThemePref = 'system' | 'light' | 'dark';
export type CurrencyPref = 'USD' | 'EUR' | 'GBP' | 'JPY';

export interface UserPrefs {
  currency: CurrencyPref;
  language: string;
  theme: ThemePref;
  defaultNetwork: string;
  notificationsEnabled: boolean;
  portfolioCompact: boolean;
  privacyMode: boolean;
}

const DEFAULTS: UserPrefs = {
  currency: 'USD',
  language: 'en',
  theme: 'system',
  defaultNetwork: 'ethereum',
  notificationsEnabled: true,
  portfolioCompact: false,
  privacyMode: false,
};

export function getUserPrefs(): UserPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<UserPrefs>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setUserPrefs(patch: Partial<UserPrefs>): UserPrefs {
  const next = { ...getUserPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

/** Session-only auth method selection for onboarding UX (does not replace JWT gateway auth). */
const AUTH_KEY = 'auvora_onboarding_auth_v1';

export type AuthMethod =
  'email' | 'google' | 'apple' | 'passkey' | 'biometric' | 'pin' | 'password' | 'magic' | 'skip';

export interface OnboardingAuthState {
  method: AuthMethod;
  email?: string;
  completedAt: string;
}

export function getOnboardingAuth(): OnboardingAuthState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as OnboardingAuthState) : null;
  } catch {
    return null;
  }
}

export function setOnboardingAuth(state: OnboardingAuthState): void {
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(state));
}
