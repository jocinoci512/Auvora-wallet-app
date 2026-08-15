/// Backend API configuration for the Auvora account (identity) layer.
///
/// The mobile app is a non-custodial wallet: wallet keys stay on-device. The
/// Auvora *account* is a separate backend identity (auth service, behind the
/// Gateway) used for cross-platform sign-in and admin visibility.
///
/// The base URL is injected at build time and is never hardcoded to a
/// localhost / Railway private / preview host:
///
///   flutter build appbundle --release \
///     --dart-define=AUVORA_API_BASE_URL=https://api.auvorawallet.com
///
/// When unset, [isConfigured] is false and the account UI shows a controlled
/// "account backend not configured" state instead of failing silently.
abstract final class AuvoraApiConfig {
  /// Public Gateway base URL (the ONLY public backend edge). No trailing slash.
  static const String baseUrl =
      String.fromEnvironment('AUVORA_API_BASE_URL', defaultValue: '');

  /// Coarse platform label recorded on the backend session/device.
  static const String platform = 'android';

  static bool get isConfigured => baseUrl.trim().isNotEmpty;

  /// Build a full endpoint URI from a `/api/v1/...` path.
  static Uri endpoint(String path) {
    final base = baseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final suffix = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$suffix');
  }
}
