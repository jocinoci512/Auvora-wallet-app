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
/// QA localhost (emulator / host loopback only):
///
///   --dart-define=AUVORA_ALLOW_LOCAL_API=true \
///   --dart-define=AUVORA_API_BASE_URL=http://10.0.2.2:3000
///
/// Default is the production Gateway. Never defaults to localhost / mock hosts.
library;

import 'package:flutter/foundation.dart';

abstract final class AuvoraApiConfig {
  static const String _rawBaseUrl = String.fromEnvironment(
    'AUVORA_API_BASE_URL',
    defaultValue: 'https://api.auvorawallet.com',
  );

  /// QA-only: when true, allow loopback / Android-emulator host URLs.
  /// Production builds must leave this unset (defaults false).
  static const bool allowLocalApi = bool.fromEnvironment(
    'AUVORA_ALLOW_LOCAL_API',
    defaultValue: false,
  );

  /// Public Gateway base URL (the ONLY public backend edge). No trailing slash.
  static String get baseUrl {
    final configured = _rawBaseUrl.trim();
    if (configured.isEmpty) return 'https://api.auvorawallet.com';
    final lower = configured.toLowerCase();
    final uri = Uri.tryParse(configured);

    if (allowLocalApi && _isAllowedLocalHost(uri)) {
      return configured.replaceAll(RegExp(r'/+$'), '');
    }

    if (lower.contains('localhost') ||
        lower.contains('127.0.0.1') ||
        lower.contains('10.0.2.2') ||
        lower.contains('0.0.0.0') ||
        lower.contains('.internal') ||
        lower.startsWith('http://')) {
      // Fail closed: refuse private/dev hosts in the client config surface.
      return '';
    }
    return configured.replaceAll(RegExp(r'/+$'), '');
  }

  /// Loopback + Android emulator host only (QA builds with [allowLocalApi]).
  static bool _isAllowedLocalHost(Uri? uri) {
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) return false;
    if (uri.scheme != 'http' && uri.scheme != 'https') return false;
    switch (uri.host.toLowerCase()) {
      case '127.0.0.1':
      case '10.0.2.2':
      case 'localhost':
        return true;
      default:
        return false;
    }
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
