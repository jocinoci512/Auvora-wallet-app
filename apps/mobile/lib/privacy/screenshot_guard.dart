import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

/// Best-effort screenshot / screen-record protection (Android FLAG_SECURE).
/// No-ops on unsupported platforms.
abstract final class ScreenshotGuard {
  static const _channel = MethodChannel('auvora/screenshot_guard');

  static Future<void> setEnabled(bool enabled) async {
    if (kIsWeb) return;
    if (defaultTargetPlatform != TargetPlatform.android) return;
    try {
      await _channel.invokeMethod<void>('setSecure', {'enabled': enabled});
    } catch (_) {
      // Channel may be missing until native wiring — fail soft for Closed Beta.
    }
  }
}
