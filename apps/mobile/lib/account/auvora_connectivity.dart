import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'auth_api_client.dart';
import 'auvora_api_config.dart';

/// Customer-facing Auvora connectivity — not a raw OS/network plugin flag.
enum AuvoraLinkState { online, connecting, degraded, offline }

/// Shared copy. Never claim "no internet" when the Auvora Gateway is reachable.
abstract final class AuvoraConnectivity {
  static const offlineMessage = "You're offline. Auvora can't be reached right now.";
  static const degradedMessage = 'Auvora is having trouble connecting. Try again in a moment.';

  /// True when the failure is a transport/socket problem, not HTTP 4xx/5xx.
  static bool isTransportFailure(Object error) {
    if (error is TimeoutException) return false;
    if (error is SocketException) return true;
    if (error is HandshakeException || error is TlsException || error is HttpException) {
      return true;
    }
    if (error is http.ClientException) return true;
    return false;
  }

  static AuthException fromTransportOrUnknown(Object error) {
    if (error is TimeoutException) {
      return const AuthException(AuthErrorKind.timeout, degradedMessage);
    }
    if (isTransportFailure(error)) {
      return const AuthException(AuthErrorKind.network, offlineMessage);
    }
    return const AuthException(AuthErrorKind.unknown, 'Something went wrong. Please try again.');
  }

  /// Probe the configured Auvora Gateway. Local QA `adb reverse` to :4000 counts
  /// as reachable even when public DNS (gstatic / 1.1.1.1) fails.
  static Future<bool> gatewayReachable({
    http.Client? httpClient,
    Duration timeout = const Duration(seconds: 3),
  }) async {
    final base = AuvoraApiConfig.baseUrl.trim();
    if (base.isEmpty) return false;
    final client = httpClient ?? http.Client();
    final owned = httpClient == null;
    try {
      final ready = Uri.parse('${base.replaceAll(RegExp(r'/+$'), '')}/ready');
      final res = await client.get(ready).timeout(timeout);
      if (res.statusCode >= 200 && res.statusCode < 500) return true;
      final health = Uri.parse('${base.replaceAll(RegExp(r'/+$'), '')}/health');
      final h = await client.get(health).timeout(timeout);
      return h.statusCode >= 200 && h.statusCode < 500;
    } catch (_) {
      return false;
    } finally {
      if (owned) client.close();
    }
  }
}
