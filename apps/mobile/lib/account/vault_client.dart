import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_api_client.dart';
import 'auvora_api_config.dart';
import 'vault_crypto.dart';

/// HTTP client for GET/PUT `/api/v1/vault` (ciphertext envelope only).
class VaultClient {
  VaultClient({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = const Duration(seconds: 45),
  })  : _http = httpClient ?? http.Client(),
        _baseUrl = (baseUrl ?? AuvoraApiConfig.baseUrl).trim();

  final http.Client _http;
  final String _baseUrl;
  final Duration timeout;

  bool get isConfigured => _baseUrl.isNotEmpty;

  Uri _endpoint(String path) {
    final base = _baseUrl.replaceAll(RegExp(r'/+$'), '');
    final suffix = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$suffix');
  }

  Map<String, String> _headers(String accessToken) => {
        'content-type': 'application/json',
        'accept': 'application/json',
        'authorization': 'Bearer $accessToken',
      };

  void _ensureConfigured() {
    if (!isConfigured) {
      throw const AuthException(
        AuthErrorKind.notConfigured,
        'Account backend is not configured for this build.',
      );
    }
  }

  Future<http.Response> _send(Future<http.Response> Function() run) async {
    try {
      return await run().timeout(timeout);
    } on TimeoutException {
      throw const AuthException(
        AuthErrorKind.timeout,
        'Encrypted vault request timed out. Please try again.',
      );
    } catch (_) {
      throw const AuthException(
        AuthErrorKind.network,
        'No internet connection. Encrypted vault sync skipped.',
      );
    }
  }

  Map<String, dynamic>? _decodeData(http.Response res) {
    Map<String, dynamic> body;
    try {
      final decoded = jsonDecode(res.body);
      body = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } catch (_) {
      body = <String, dynamic>{};
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      final data = body['data'];
      if (data == null) return null;
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      return null;
    }
    throw _mapError(res.statusCode, body: res.body);
  }

  AuthException _mapError(int status, {String? body}) {
    // Prefer customer-safe copy; never surface schema/field names from the API.
    switch (status) {
      case 401:
      case 403:
        return const AuthException(
          AuthErrorKind.forbidden,
          'Sign in is required before encrypted vault sync.',
        );
      case 404:
        return const AuthException(AuthErrorKind.unknown, 'Encrypted vault not found.');
      case 422:
      case 400:
        return const AuthException(
          AuthErrorKind.unknown,
          'Secure backup could not be completed. Please try again.',
        );
      case 429:
        return const AuthException(
          AuthErrorKind.rateLimited,
          'Too many vault sync attempts. Please wait and try again.',
        );
      default:
        if (status >= 500) {
          return const AuthException(
            AuthErrorKind.server,
            'Secure backup could not be completed. Please try again.',
          );
        }
        return const AuthException(
          AuthErrorKind.unknown,
          'Secure backup could not be completed. Please try again.',
        );
    }
  }

  /// Returns null when the account has no cloud vault blob yet.
  Future<EncryptedVaultEnvelope?> getVault({required String accessToken}) async {
    _ensureConfigured();
    final res = await _send(
      () => _http.get(_endpoint('/api/v1/vault'), headers: _headers(accessToken)),
    );
    final data = _decodeData(res);
    if (data == null) return null;
    return EncryptedVaultEnvelope.fromJson(data);
  }

  Future<EncryptedVaultEnvelope> upsertVault({
    required String accessToken,
    required VaultUploadPayload payload,
    String? deviceId,
  }) async {
    _ensureConfigured();
    final body = <String, Object?>{
      ...payload.toJson(),
      if (deviceId != null && deviceId.isNotEmpty) 'deviceId': deviceId,
    };
    final res = await _send(
      () => _http.put(
        _endpoint('/api/v1/vault'),
        headers: _headers(accessToken),
        body: jsonEncode(body),
      ),
    );
    final data = _decodeData(res);
    if (data == null) {
      throw const AuthException(
        AuthErrorKind.server,
        'Encrypted vault upsert returned an empty response.',
      );
    }
    return EncryptedVaultEnvelope.fromJson(data);
  }
}
