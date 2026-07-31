/// Lightweight fuzzy matching for global search (typo-tolerant).
/// Pure Dart — no network, safe for offline Help / Settings / portfolio search.
library;

int levenshtein(String a, String b) {
  if (a == b) return 0;
  if (a.isEmpty) return b.length;
  if (b.isEmpty) return a.length;
  final prev = List<int>.generate(b.length + 1, (i) => i);
  final curr = List<int>.filled(b.length + 1, 0);
  for (var i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (var j = 1; j <= b.length; j++) {
      final cost = a[i - 1] == b[j - 1] ? 0 : 1;
      curr[j] = [
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      ].reduce((x, y) => x < y ? x : y);
    }
    for (var j = 0; j <= b.length; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}

/// Score 0–100 (higher is better). Empty query → 0.
double fuzzyScore(String query, String candidate) {
  final q = query.trim().toLowerCase();
  final c = candidate.trim().toLowerCase();
  if (q.isEmpty || c.isEmpty) return 0;
  if (c == q) return 100;
  if (c.startsWith(q)) return 92;
  if (c.contains(q)) return 80;

  // Token-level contains (e.g. "eth fee" vs "Ethereum gas fees").
  final tokens = q.split(RegExp(r'\s+')).where((t) => t.isNotEmpty);
  var tokenHits = 0;
  for (final t in tokens) {
    if (c.contains(t)) tokenHits++;
  }
  if (tokenHits > 0 && tokenHits == tokens.length) return 72;
  if (tokenHits > 0) return 55.0 + (tokenHits * 5);

  final dist = levenshtein(q, c.length > q.length + 4 ? c.substring(0, q.length + 4) : c);
  final maxLen = q.length > c.length ? q.length : c.length;
  if (maxLen == 0) return 0;
  final similarity = 1.0 - (dist / maxLen);
  if (similarity >= 0.72) return 50 + (similarity * 30);
  // Allow 1–2 char typos on short queries.
  if (q.length >= 3 && dist <= 2) return 45;
  if (q.length >= 5 && dist <= 3) return 38;
  return 0;
}

bool fuzzyMatches(String query, String candidate, {double minScore = 38}) {
  return fuzzyScore(query, candidate) >= minScore;
}

bool fuzzyMatchesAny(String query, Iterable<String> candidates, {double minScore = 38}) {
  for (final c in candidates) {
    if (fuzzyMatches(query, c, minScore: minScore)) return true;
  }
  return false;
}

/// Rank hits by best fuzzy score across fields.
List<T> fuzzyRank<T>(
  String query,
  Iterable<T> items,
  List<String> Function(T item) fields, {
  double minScore = 38,
}) {
  final scored = <({T item, double score})>[];
  for (final item in items) {
    var best = 0.0;
    for (final field in fields(item)) {
      final s = fuzzyScore(query, field);
      if (s > best) best = s;
    }
    if (best >= minScore) scored.add((item: item, score: best));
  }
  scored.sort((a, b) => b.score.compareTo(a.score));
  return [for (final s in scored) s.item];
}
