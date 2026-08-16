/**
 * Strip WalletConnect / Reown secrets before any UI render.
 * Never display symKey, proposal URI, session secrets, or signing material.
 */

const SECRET_KEY =
  /^(symkey|uri|encrypteduri|sessionkey|qrpayload|deeplink|proposaluri|pairinguri|secret|privatekey|mnemonic|seed|seedphrase|refreshtoken|accesstoken|jwt|authorization)$/i;

const SECRET_VALUE =
  /symKey=|wc:[^\s]+@\d|mnemonic|seed phrase|private key|BEGIN (EC |RSA )?PRIVATE/i;

export type SafeConnectionView = {
  id: string;
  name: string;
  domain: string;
  status: 'connected' | 'pending' | 'expired' | 'disconnected';
  networks: string[];
  accounts: string[];
  permissions: string[];
  connectedAt: string | null;
  lastActivity: string | null;
  source: 'walletconnect' | 'dapp' | 'pairing' | 'sample';
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function hostnameFrom(originOrUrl: string): string {
  try {
    return new URL(originOrUrl).hostname.replace(/^www\./, '');
  } catch {
    return originOrUrl.replace(/^https?:\/\//, '').split('/')[0] ?? originOrUrl;
  }
}

function mapStatus(raw: string): SafeConnectionView['status'] {
  const s = raw.toLowerCase();
  if (s.includes('pend')) return 'pending';
  if (s.includes('expir') || s.includes('timeout')) return 'expired';
  if (s.includes('term') || s.includes('disconnect') || s.includes('reject')) {
    return 'disconnected';
  }
  return 'connected';
}

export function stripSecretFields(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(stripSecretFields);
  if (!input || typeof input !== 'object') {
    if (typeof input === 'string' && SECRET_VALUE.test(input)) return '[redacted]';
    return input;
  }
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY.test(key.replace(/[_-]/g, ''))) continue;
    out[key] = stripSecretFields(value);
  }
  return out;
}

export function containsSecretMaterial(value: unknown): boolean {
  if (typeof value === 'string') return SECRET_VALUE.test(value) || SECRET_KEY.test(value);
  if (Array.isArray(value)) return value.some(containsSecretMaterial);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).some(
      ([k, v]) => SECRET_KEY.test(k.replace(/[_-]/g, '')) || containsSecretMaterial(v),
    );
  }
  return false;
}

export function toSafeConnectionView(
  raw: unknown,
  fallback: Partial<SafeConnectionView> = {},
): SafeConnectionView | null {
  if (!raw || typeof raw !== 'object') return null;
  const safe = stripSecretFields(raw) as Record<string, unknown>;
  const id = asString(safe.id || safe.sessionId || fallback.id);
  if (!id) return null;
  const origin = asString(safe.origin || safe.url || safe.name || fallback.domain || fallback.name);
  const networks = Array.isArray(safe.networks)
    ? safe.networks.map((n) => asString(n)).filter(Boolean)
    : (fallback.networks ?? []);
  const accounts = Array.isArray(safe.accounts)
    ? safe.accounts.map((a) => asString(a)).filter(Boolean)
    : (fallback.accounts ?? []);
  const permissions = Array.isArray(safe.permissions)
    ? safe.permissions.map((p) => asString(p)).filter(Boolean)
    : (fallback.permissions ?? []);
  return {
    id,
    name: asString(
      safe.label || safe.name || fallback.name || hostnameFrom(origin) || 'Connected app',
    ),
    domain: hostnameFrom(origin),
    status: mapStatus(asString(safe.status || fallback.status || 'connected')),
    networks: networks.length ? networks : (fallback.networks ?? []),
    accounts: accounts.length ? accounts : (fallback.accounts ?? []),
    permissions,
    connectedAt: asString(safe.connectedAt || safe.createdAt || fallback.connectedAt) || null,
    lastActivity: asString(safe.updatedAt || safe.lastActivity || fallback.lastActivity) || null,
    source: fallback.source ?? 'walletconnect',
  };
}
