const VIEWED_KEY = 'auvora_nft_viewed_v1';
const LABELS_KEY = 'auvora_nft_wallet_labels_v1';

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
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

export function listRecentlyViewed(): string[] {
  const value = readJson<unknown>(VIEWED_KEY, []);
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
}

export function pushRecentlyViewed(assetId: string): void {
  const next = [assetId, ...listRecentlyViewed().filter((id) => id !== assetId)].slice(0, 40);
  writeJson(VIEWED_KEY, next);
}

export function getWalletLabels(): Record<string, string> {
  return readJson<Record<string, string>>(LABELS_KEY, {});
}

export function setWalletLabel(walletKey: string, label: string): void {
  const all = getWalletLabels();
  const trimmed = label.trim();
  if (!trimmed) delete all[walletKey];
  else all[walletKey] = trimmed;
  writeJson(LABELS_KEY, all);
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function shareAssetUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}
