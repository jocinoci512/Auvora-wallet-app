export type AccountPrefs = {
  displayName: string;
  walletNickname: string;
  defaultWalletId: string;
  language: string;
  region: string;
  currency: string;
  timeZone: string;
  dateFormat: 'MDY' | 'DMY' | 'YMD';
  timeFormat: '12h' | '24h';
  defaultNetwork: string;
  fiatDisplay: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
};

export type PrivacyPrefs = {
  analytics: boolean;
  crashReporting: boolean;
  cookiesEssential: boolean;
  cookiesAnalytics: boolean;
  personalization: boolean;
  /** Allow on-device assistant suggestions (never sends keys). */
  aiAssistant: boolean;
  /** Keep local assistant chat history on this device. */
  aiChatHistory: boolean;
};

export type NotificationPrefsLocal = {
  incomingTransactions: boolean;
  outgoingTransactions: boolean;
  transactionConfirmations: boolean;
  priceAlerts: boolean;
  largeBalanceChanges: boolean;
  securityAlerts: boolean;
  walletConnections: boolean;
  softwareUpdates: boolean;
  networkOutages: boolean;
  /** Legacy aliases kept for older localStorage blobs */
  transactions?: boolean;
  stakingRewards?: boolean;
  marketing?: boolean;
  productUpdates?: boolean;
  web3Activity?: boolean;
  insightAlerts?: boolean;
  portfolioHealth?: boolean;
  largeTransfers?: boolean;
  highNetworkFees?: boolean;
};

export type BackupPrefs = {
  phraseVerified: boolean;
  lastVerifiedAt: string | null;
  reminderEnabled: boolean;
};

const ACCOUNT_KEY = 'auvora_account_prefs_v1';
const PRIVACY_KEY = 'auvora_privacy_prefs_v1';
const NOTIF_KEY = 'auvora_notif_prefs_local_v1';
const BACKUP_KEY = 'auvora_backup_prefs_v1';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return fallback;
    return { ...fallback, ...(parsed as Partial<T>) };
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const ACCOUNT_DEFAULTS: AccountPrefs = {
  displayName: 'Auvora user',
  walletNickname: 'Primary',
  defaultWalletId: 'wallet-primary',
  language: 'en',
  region: 'US',
  currency: 'USD',
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  dateFormat: 'MDY',
  timeFormat: '12h',
  defaultNetwork: 'ETHEREUM',
  fiatDisplay: true,
  reduceMotion: false,
  highContrast: false,
};

const PRIVACY_DEFAULTS: PrivacyPrefs = {
  analytics: false,
  crashReporting: true,
  cookiesEssential: true,
  cookiesAnalytics: false,
  personalization: true,
  aiAssistant: true,
  aiChatHistory: true,
};

const NOTIF_DEFAULTS: NotificationPrefsLocal = {
  incomingTransactions: true,
  outgoingTransactions: true,
  transactionConfirmations: true,
  priceAlerts: true,
  largeBalanceChanges: true,
  securityAlerts: true,
  walletConnections: true,
  softwareUpdates: true,
  networkOutages: true,
  marketing: false,
};

const BACKUP_DEFAULTS: BackupPrefs = {
  phraseVerified: false,
  lastVerifiedAt: null,
  reminderEnabled: true,
};

export function getAccountPrefs(): AccountPrefs {
  return readJson(ACCOUNT_KEY, ACCOUNT_DEFAULTS);
}

export function setAccountPrefs(patch: Partial<AccountPrefs>): AccountPrefs {
  const next = { ...getAccountPrefs(), ...patch };
  writeJson(ACCOUNT_KEY, next);
  return next;
}

export function getPrivacyPrefs(): PrivacyPrefs {
  return readJson(PRIVACY_KEY, PRIVACY_DEFAULTS);
}

export function setPrivacyPrefs(patch: Partial<PrivacyPrefs>): PrivacyPrefs {
  const next = { ...getPrivacyPrefs(), ...patch };
  writeJson(PRIVACY_KEY, next);
  return next;
}

export function getNotifPrefs(): NotificationPrefsLocal {
  return readJson(NOTIF_KEY, NOTIF_DEFAULTS);
}

export function setNotifPrefs(patch: Partial<NotificationPrefsLocal>): NotificationPrefsLocal {
  const next = { ...getNotifPrefs(), ...patch };
  writeJson(NOTIF_KEY, next);
  return next;
}

export function getBackupPrefs(): BackupPrefs {
  return readJson(BACKUP_KEY, BACKUP_DEFAULTS);
}

export function setBackupPrefs(patch: Partial<BackupPrefs>): BackupPrefs {
  const next = { ...getBackupPrefs(), ...patch };
  writeJson(BACKUP_KEY, next);
  return next;
}
