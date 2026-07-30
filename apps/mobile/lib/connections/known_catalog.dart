/// Known project origins used for preview trust / lookalike heuristics.
class KnownDappEntry {
  const KnownDappEntry({
    required this.name,
    required this.originHost,
    required this.verified,
  });

  final String name;
  final String originHost;
  final bool verified;
}

const kKnownDappCatalog = <KnownDappEntry>[
  KnownDappEntry(name: 'Uniswap', originHost: 'app.uniswap.org', verified: true),
  KnownDappEntry(name: 'Aave', originHost: 'app.aave.com', verified: true),
  KnownDappEntry(name: 'Snapshot', originHost: 'snapshot.org', verified: true),
  KnownDappEntry(name: 'Dune', originHost: 'dune.com', verified: true),
  KnownDappEntry(name: 'Lens', originHost: 'hey.xyz', verified: false),
];

/// Explicit typo / phishing hosts for common lookalikes (preview heuristics).
const kLookalikeHosts = <String, String>{
  'unlswap.org': 'app.uniswap.org',
  'www.unlswap.org': 'app.uniswap.org',
  'app.unlswap.org': 'app.uniswap.org',
  'uniswaap.org': 'app.uniswap.org',
  'app.uniswaap.org': 'app.uniswap.org',
  'uniswap.com': 'app.uniswap.org',
  'app.aavee.com': 'app.aave.com',
  'aavee.com': 'app.aave.com',
};

KnownDappEntry? lookupKnownDapp(String origin) {
  final host = _hostOf(origin);
  if (host == null) return null;
  for (final entry in kKnownDappCatalog) {
    // Exact host only — do not trust arbitrary subdomains of catalog hosts.
    if (host == entry.originHost) return entry;
  }
  return null;
}

/// Lookalike check: explicit typo map + light edit-distance on registrable labels.
String? lookalikeHint(String origin) {
  final host = _hostOf(origin);
  if (host == null) return null;
  if (lookupKnownDapp(origin) != null) return null;

  final mapped = kLookalikeHosts[host];
  if (mapped != null) {
    final known = kKnownDappCatalog.cast<KnownDappEntry?>().firstWhere(
          (e) => e!.originHost == mapped,
          orElse: () => null,
        );
    final name = known?.name ?? mapped;
    return 'This address looks similar to $name ($mapped). Double-check before connecting.';
  }

  for (final entry in kKnownDappCatalog) {
    if (_looksSimilar(host, entry.originHost) ||
        _looksSimilar(_registrable(host), _registrable(entry.originHost))) {
      return 'This address looks similar to ${entry.name} (${entry.originHost}). Double-check before connecting.';
    }
  }
  return null;
}

String? _hostOf(String origin) {
  try {
    final uri = Uri.parse(origin.contains('://') ? origin : 'https://$origin');
    return uri.host.toLowerCase();
  } catch (_) {
    return null;
  }
}

String _registrable(String host) {
  final parts = host.split('.');
  if (parts.length <= 2) return host;
  return parts.sublist(parts.length - 2).join('.');
}

bool _looksSimilar(String a, String b) {
  if (a == b) return false;
  if ((a.length - b.length).abs() > 2) return false;
  final distance = _levenshtein(a, b);
  if (distance == 0) return false;
  if (distance <= 2) return true;
  final shorter = a.length <= b.length ? a : b;
  final longer = a.length > b.length ? a : b;
  final prefixLen = (shorter.length * 0.6).floor().clamp(3, shorter.length);
  if (!longer.startsWith(shorter.substring(0, prefixLen))) return false;
  return distance <= 2;
}

int _levenshtein(String a, String b) {
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
