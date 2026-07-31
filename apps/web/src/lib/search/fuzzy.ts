/** Typo-tolerant search scoring for Settings / Help / Intelligence assist. */

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

/** Score 0–100 (higher is better). */
export function fuzzyScore(query: string, candidate: string): number {
  const q = query.trim().toLowerCase();
  const c = candidate.trim().toLowerCase();
  if (!q || !c) return 0;
  if (c === q) return 100;
  if (c.startsWith(q)) return 92;
  if (c.includes(q)) return 80;
  const tokens = q.split(/\s+/).filter(Boolean);
  let hits = 0;
  for (const t of tokens) if (c.includes(t)) hits++;
  if (hits > 0 && hits === tokens.length) return 72;
  if (hits > 0) return 55 + hits * 5;
  const clipped = c.length > q.length + 4 ? c.slice(0, q.length + 4) : c;
  const dist = levenshtein(q, clipped);
  const maxLen = Math.max(q.length, clipped.length) || 1;
  const similarity = 1 - dist / maxLen;
  if (similarity >= 0.72) return 50 + similarity * 30;
  if (q.length >= 3 && dist <= 2) return 45;
  if (q.length >= 5 && dist <= 3) return 38;
  return 0;
}

export function fuzzyMatches(query: string, candidate: string, minScore = 38): boolean {
  return fuzzyScore(query, candidate) >= minScore;
}

export function fuzzyRank<T>(
  query: string,
  items: readonly T[],
  fields: (item: T) => string[],
  minScore = 38,
): T[] {
  const scored = items
    .map((item) => {
      let best = 0;
      for (const field of fields(item)) best = Math.max(best, fuzzyScore(query, field));
      return { item, score: best };
    })
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}
