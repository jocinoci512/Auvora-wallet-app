import type { SecurityPrefs } from './types';

const KEY = 'auvora_security_prefs_v1';

const DEFAULTS: SecurityPrefs = {
  pinEnabled: false,
  pinHash: null,
  biometricEnabled: false,
  autoLockMinutes: 5,
  sessionTimeoutMinutes: 30,
  backupReminderEnabled: true,
  lastBackupReminderAt: null,
  suspiciousAddressWarnings: true,
  lastUnlockedAt: null,
  requireAuthForSend: true,
  requireAuthForSettings: true,
  requireAuthForRecoveryPhrase: true,
  hideSensitiveInfo: false,
  notificationPrivacy: true,
  clipboardTimeoutSeconds: 30,
  lastSecurityReviewAt: null,
  emergencyNotificationsMuted: false,
};

export function getSecurityPrefs(): SecurityPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SecurityPrefs>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSecurityPrefs(patch: Partial<SecurityPrefs>): SecurityPrefs {
  const next = { ...getSecurityPrefs(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`auvora-pin:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(pin: string): Promise<boolean> {
  const prefs = getSecurityPrefs();
  if (!prefs.pinHash) return false;
  return (await hashPin(pin)) === prefs.pinHash;
}

export function isSessionExpired(prefs: SecurityPrefs = getSecurityPrefs()): boolean {
  if (!prefs.lastUnlockedAt) return prefs.pinEnabled;
  const elapsed = Date.now() - new Date(prefs.lastUnlockedAt).getTime();
  return elapsed > prefs.sessionTimeoutMinutes * 60_000;
}

/** Heuristic risk flags for destinations (client-side education layer). */
export function assessAddressRisk(address: string): {
  level: 'ok' | 'warn' | 'high';
  reasons: string[];
} {
  const reasons: string[] = [];
  const a = address.trim();
  if (!a) return { level: 'ok', reasons };
  if (/^(0x)?0+$/i.test(a.replace(/^0x/i, '0x'))) {
    reasons.push('Looks like a null / burn address');
  }
  if (a.length < 20) {
    reasons.push('Address is unusually short');
  }
  if (/[IlO0]{6,}/.test(a)) {
    reasons.push('Homoglyph-heavy characters — double-check carefully');
  }
  if (/test|fake|example/i.test(a)) {
    reasons.push('Contains placeholder-like text');
  }
  const level = reasons.some((r) => /null|burn|placeholder/i.test(r))
    ? 'high'
    : reasons.length
      ? 'warn'
      : 'ok';
  return { level, reasons };
}
