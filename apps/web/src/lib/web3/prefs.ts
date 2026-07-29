const FAV_KEY = 'auvora_web3_favorites_v1';
const HIST_KEY = 'auvora_web3_browser_history_v1';
const BOOK_KEY = 'auvora_web3_bookmarks_v1';

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

export function listFavorites(): string[] {
  const v = readJson<unknown>(FAV_KEY, []);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function toggleFavorite(dappId: string): string[] {
  const cur = listFavorites();
  const next = cur.includes(dappId)
    ? cur.filter((id) => id !== dappId)
    : [dappId, ...cur].slice(0, 40);
  writeJson(FAV_KEY, next);
  return next;
}

export type BrowserHistoryEntry = {
  id: string;
  url: string;
  title: string;
  visitedAt: string;
};

function isHistoryEntry(v: unknown): v is BrowserHistoryEntry {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.url === 'string' &&
    typeof r.title === 'string' &&
    typeof r.visitedAt === 'string'
  );
}

export function listBrowserHistory(): BrowserHistoryEntry[] {
  const v = readJson<unknown>(HIST_KEY, []);
  return Array.isArray(v) ? v.filter(isHistoryEntry) : [];
}

export function pushBrowserHistory(entry: Omit<BrowserHistoryEntry, 'id' | 'visitedAt'>): void {
  const item: BrowserHistoryEntry = {
    id: `h-${crypto.randomUUID().slice(0, 8)}`,
    url: entry.url,
    title: entry.title,
    visitedAt: new Date().toISOString(),
  };
  writeJson(
    HIST_KEY,
    [item, ...listBrowserHistory().filter((h) => h.url !== entry.url)].slice(0, 50),
  );
}

export type LocalBookmark = { id: string; url: string; title: string; createdAt: string };

function isBookmark(v: unknown): v is LocalBookmark {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.url === 'string' &&
    typeof r.title === 'string' &&
    typeof r.createdAt === 'string'
  );
}

export function listLocalBookmarks(): LocalBookmark[] {
  const v = readJson<unknown>(BOOK_KEY, []);
  return Array.isArray(v) ? v.filter(isBookmark) : [];
}

export function upsertLocalBookmark(url: string, title: string): LocalBookmark[] {
  const next = [
    { id: `b-${crypto.randomUUID().slice(0, 6)}`, url, title, createdAt: new Date().toISOString() },
    ...listLocalBookmarks().filter((b) => b.url !== url),
  ].slice(0, 40);
  writeJson(BOOK_KEY, next);
  return next;
}

export function removeLocalBookmark(id: string): LocalBookmark[] {
  const next = listLocalBookmarks().filter((b) => b.id !== id);
  writeJson(BOOK_KEY, next);
  return next;
}
