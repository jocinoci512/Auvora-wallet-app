/// Backend API configuration for the Auvora account (identity) layer.
///
/// The mobile app is a non-custodial wallet: wallet keys stay on-device. The
/// Auvora *account* is a separate backend identity (auth service, behind the
/// Gateway) used for cross-platform sign-in and admin visibility.
///
/// Override at build time when needed:
///
///   flutter build apk --release \
///     --dart-define=AUVORA_API_BASE_URL=https://api.auvorawallet.com
///
/// Default is the production Gateway. Never defaults to localhost / mock hosts.
library;

import 'package:flutter/foundation.dart';

abstract final class AuvoraApiConfig {
  static const String _rawBaseUrl = String.fromEnvironment(
    'AUVORA_API_BASE_URL',
    defaultValue: 'https://api.auvorawallet.com',
  );

  /// Public Gateway base URL (the ONLY public backend edge). No trailing slash.
  static String get baseUrl {
    final configured = _rawBaseUrl.trim();
    if (configured.isEmpty) return 'https://api.auvorawallet.com';
    final lower = configured.toLowerCase();
    if (lower.contains('localhost') ||
        lower.contains('127.0.0.1') ||
        lower.contains('0.0.0.0') ||
        lower.contains('.internal') ||
        lower.startsWith('http://')) {
      // Fail closed: refuse private/dev hosts in the client config surface.
      return '';
    }
    return configured.replaceAll(RegExp(r'/+$'), '');
  }

  /// Coarse platform label recorded on the backend session/device.
  static String get platform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.macOS:
        return 'macos';
      default:
        return 'android';
    }
  }

  static bool get isConfigured => baseUrl.isNotEmpty;

  /// Build a full endpoint URI from a `/api/v1/...` path.
  static Uri endpoint(String path) {
    final suffix = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$suffix');
  }
}
