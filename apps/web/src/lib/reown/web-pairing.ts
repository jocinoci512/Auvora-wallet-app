/**
 * Web <-> Mobile pairing foundation via the same Reown Cloud project as Android.
 *
 * - Private keys NEVER leave the mobile vault.
 * - Browser only uses the public Project ID (NEXT_PUBLIC_WC_PROJECT_ID).
 * - Reown Secret must never ship to the browser.
 * - Full Universal Provider relay is optional; session restore works offline from local store.
 */

export type PairingSession = {
  topic: string;
  name: string;
  url?: string;
  chains: string[];
  accounts: string[];
  pairedAt: string;
  lastActiveAt: string;
  source: 'reown' | 'manual' | 'preview';
};

const STORE_KEY = 'auvora_reown_web_sessions_v1';

export function getPublicWcProjectId(): string | null {
  const raw = process.env['NEXT_PUBLIC_WC_PROJECT_ID']?.trim();
  if (!raw || raw === 'your-project-id' || raw.toLowerCase().includes('placeholder')) {
    return null;
  }
  return raw;
}

export function isReownWebConfigured(): boolean {
  return Boolean(getPublicWcProjectId());
}

export function listPairingSessions(): PairingSession[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PairingSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePairingSessions(sessions: PairingSession[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORE_KEY, JSON.stringify(sessions));
}

export function upsertPairingSession(session: PairingSession): PairingSession[] {
  const next = listPairingSessions().filter((s) => s.topic !== session.topic);
  next.unshift(session);
  savePairingSessions(next);
  return next;
}

export function disconnectPairingSession(topic: string): PairingSession[] {
  const next = listPairingSessions().filter((s) => s.topic !== topic);
  savePairingSessions(next);
  return next;
}

export function disconnectAllPairingSessions(): void {
  savePairingSessions([]);
}

/** Build a deep-link hint for Auvora mobile (wallet-side). */
export function buildMobilePairHint(projectConfigured: boolean): string {
  if (!projectConfigured) {
    return 'Configure NEXT_PUBLIC_WC_PROJECT_ID (same Reown Cloud project as Android WC_PROJECT_ID) to enable live pairing.';
  }
  return 'Open Auvora on Android -> Connections -> scan or paste a WalletConnect URI from a dApp. This web companion stores restored sessions locally and never holds your seed.';
}

/** Deep link into Auvora Android WalletConnect entry (same project). */
export function buildAuvoraMobileDeepLink(wcUri?: string): string {
  if (wcUri && wcUri.toLowerCase().startsWith('wc:')) {
    return `auvora://wc?uri=${encodeURIComponent(wcUri)}`;
  }
  return 'auvora://wc';
}

export function buildConnectMobilePayload(projectId: string | null): {
  deepLink: string;
  qrPayload: string;
  instructions: string;
} {
  // Companion QR opens Android pair host (manifest + deep-link handler).
  // Full live WC session still requires a wc: URI (paste on /web3/pair or from a dApp)
  // until Universal Provider relay is wired on web.
  const deepLink = projectId
    ? `auvora://pair?projectId=${encodeURIComponent(projectId)}&role=web-companion`
    : 'auvora://pair';
  const qrPayload = deepLink;
  return {
    deepLink,
    qrPayload,
    instructions: projectId
      ? 'Scan with Auvora Android (same Reown Cloud project). The app opens Connect dApp — paste a WalletConnect URI from this page or a dApp to complete relay pairing. Keys never leave mobile. Live broadcast remains off.'
      : 'Project ID missing — deep link still opens the app, but live Reown relay will not connect until NEXT_PUBLIC_WC_PROJECT_ID is set (same value as mobile WC_PROJECT_ID).',
  };
}

/**
 * Create a local preview session for UX rehearsal when relay is unavailable.
 * Marked source:'preview' so UI never claims live Reown.
 */
export function createPreviewSession(label = 'Auvora Mobile (preview)'): PairingSession {
  const now = new Date().toISOString();
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `preview-${Date.now()}`;
  return {
    topic: `preview-${id}`,
    name: label,
    url: 'auvora://wallet',
    chains: ['eip155:1', 'eip155:137', 'eip155:56', 'solana:mainnet'],
    accounts: [],
    pairedAt: now,
    lastActiveAt: now,
    source: 'preview',
  };
}
