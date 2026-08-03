import 'package:flutter/foundation.dart';

import '../release/release_config.dart';

/// Debug / diagnostics stopwatches for Android cold-start phases.
/// Never logs secrets. Gated by [ReleaseConfig.clientDiagnosticsEnabled].
abstract final class StartupTiming {
  static final Stopwatch _app = Stopwatch();
  static final Map<String, int> _marksMs = {};

  static bool get _enabled =>
      kDebugMode || ReleaseConfig.clientDiagnosticsEnabled;

  static void markAppStart() {
    if (!_enabled) return;
    _app
      ..reset()
      ..start();
    _marksMs.clear();
  }

  static void mark(String phase) {
    if (!_enabled || !_app.isRunning) return;
    _marksMs[phase] = _app.elapsedMilliseconds;
    if (kDebugMode) {
      debugPrint('[AuvoraStartup] $phase @ ${_marksMs[phase]}ms');
    }
  }

  static Map<String, int> snapshot() => Map.unmodifiable(_marksMs);

  static int? msSinceStart(String phase) => _marksMs[phase];
}
