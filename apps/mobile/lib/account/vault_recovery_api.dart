import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auth_api_client.dart';
import 'auvora_api_config.dart';
import 'device_wrap.dart';
import 'vault_crypto.dart';

class VaultRecoveryRequest {
  const VaultRecoveryRequest({
    required this.requestId,
    this.requestingPlatform,
    this.requestingDeviceFingerprint,
    this.createdAt,
    this.expiresAt,
    this.status,
    this.requestingPublicKey,
  });

  final String requestId;
  final String? requestingPlatform;
  final String? requestingDeviceFingerprint;
  final DateTime? createdAt;
  final DateTime? expiresAt;
  final String? status;
  final String? requestingPublicKey;

  factory VaultRecoveryRequest.fromJson(Map<String, dynamic> json) => VaultRecoveryRequest(
        requestId: (json['requestId'] ?? json['id'] ?? '').toString(),
        requestingPlatform: json['requestingPlatform'] as String?,
        requestingDeviceFingerprint: json['requestingDeviceFingerprint'] as String?,
        createdAt: DateTime.tryParse((json['createdAt'] ?? '').toString()),
        expiresAt: DateTime.tryParse((json['expiresAt'] ?? '').toString()),
        status: json['status'] as String?,
        requestingPublicKey: json['requestingPublicKey'] as String?,
      );
}

class VaultRecoveryCollectResult {
  const VaultRecoveryCollectResult({
    required this.requestId,
    required this.ownerUserId,
    required this.wrapped,
  });

  final String requestId;
  final String ownerUserId;
  final DeviceWrappedVaultKey wrapped;

  factory VaultRecoveryCollectResult.fromJson(Map<String, dynamic> json) {
    final wrappedRaw = json['wrapped'];
    return VaultRecoveryCollectResult(
      requestId: (json['requestId'] ?? '').toString(),
      ownerUserId: (json['ownerUserId'] ?? '').toString(),
      wrapped: wrappedRaw is Map
          ? DeviceWrappedVaultKey.fromJson(Map<String, dynamic>.from(wrappedRaw))
          : const DeviceWrappedVaultKey(
              algorithmId: kDeviceWrapAlg,
              ciphertext: '',
              nonce: '',
              ephemeralPublicKey: '',
              aad: '',
            ),
    );
  }
}

/// HTTP client for vault device recovery endpoints (ciphertext relay only).
class VaultRecoveryApi {
  VaultRecoveryApi({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = const Duration(seconds: 30),
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

  Map<String, String> _headers({String? bearer}) => {
        'content-type': 'application/json',
        'accept': 'application/json',
        if (bearer != null && bearer.isNotEmpty) 'authorization': 'Bearer $bearer',
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
      throw const AuthException(AuthErrorKind.timeout, 'Recovery request timed out. Please try again.');
    } catch (_) {
      throw const AuthException(
        AuthErrorKind.network,
        'No internet connection. Recovery could not continue.',
      );
    }
  }

  Map<String, dynamic> _decodeBody(http.Response res) {
    try {
      final decoded = jsonDecode(res.body);
      return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  Map<String, dynamic> _decodeData(http.Response res) {
    final body = _decodeBody(res);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      final data = body['data'];
      return data is Map<String, dynamic> ? data : body;
    }
    throw _mapError(res.statusCode, body);
  }

  List<Map<String, dynamic>> _decodeList(http.Response res) {
    final body = _decodeBody(res);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw _mapError(res.statusCode, body);
    }
    final data = body['data'];
    if (data is List) {
      return [
        for (final item in data)
          if (item is Map) Map<String, dynamic>.from(item),
      ];
    }
    return const [];
  }

  AuthException _mapError(int status, Map<String, dynamic> body) {
    final serverMessage = () {
      final err = body['error'];
      if (err is Map && err['message'] is String) {
        return (err['message'] as String).trim();
      }
      return '';
    }();
    final lower = serverMessage.toLowerCase();

    switch (status) {
      case 401:
        return const AuthException(
          AuthErrorKind.invalidCredentials,
          'Recovery authorization expired or is invalid.',
        );
      case 403:
        return const AuthException(
          AuthErrorKind.forbidden,
          'This recovery request is bound to another device.',
        );
      case 404:
        return const AuthException(AuthErrorKind.unknown, 'Recovery request not found.');
      case 422:
      case 400:
        if (lower.contains('approved')) {
          return const AuthException(
            AuthErrorKind.unknown,
            'Waiting for a trusted device to approve this recovery.',
          );
        }
        return AuthException(AuthErrorKind.unknown, serverMessage.isNotEmpty ? serverMessage : 'Recovery could not continue.');
      case 429:
        return const AuthException(AuthErrorKind.rateLimited, 'Too many recovery attempts. Please wait.');
      default:
        if (status >= 500) {
          return const AuthException(AuthErrorKind.server, 'Auvora is having trouble. Please try again shortly.');
        }
        return const AuthException(AuthErrorKind.unknown, 'Recovery could not continue.');
    }
  }

  Future<VaultRecoveryRequest> createRequest({
    required String resetToken,
    required String requestingDeviceFingerprint,
    required String requestingPublicKey,
    String? requestingPlatform,
  }) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/me/vault-recovery/requests'),
          headers: _headers(),
          body: jsonEncode({
            'resetToken': resetToken,
            'requestingDeviceFingerprint': requestingDeviceFingerprint,
            'requestingPublicKey': requestingPublicKey,
            if (requestingPlatform != null && requestingPlatform.isNotEmpty)
              'requestingPlatform': requestingPlatform,
          }),
        ));
    final data = _decodeData(res);
    return VaultRecoveryRequest.fromJson(data);
  }

  Future<List<VaultRecoveryRequest>> listPending(String accessToken) async {
    _ensureConfigured();
    final res = await _send(() => _http.get(
          _endpoint('/api/v1/me/vault-recovery/requests/pending'),
          headers: _headers(bearer: accessToken),
        ));
    return [
      for (final item in _decodeList(res)) VaultRecoveryRequest.fromJson(item),
    ];
  }

  Future<void> approveRequest({
    required String accessToken,
    required String requestId,
    required DeviceWrappedVaultKey wrapped,
    String? approvingDeviceId,
  }) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/me/vault-recovery/requests/${Uri.encodeComponent(requestId)}/approve'),
          headers: _headers(bearer: accessToken),
          body: jsonEncode({
            'ciphertext': wrapped.ciphertext,
            'nonce': wrapped.nonce,
            'ephemeralPublicKey': wrapped.ephemeralPublicKey,
            'aad': wrapped.aad,
            if (approvingDeviceId != null && approvingDeviceId.isNotEmpty)
              'approvingDeviceId': approvingDeviceId,
          }),
        ));
    _decodeData(res);
  }

  Future<void> denyRequest({
    required String accessToken,
    required String requestId,
  }) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/me/vault-recovery/requests/${Uri.encodeComponent(requestId)}/deny'),
          headers: _headers(bearer: accessToken),
          body: jsonEncode(const <String, dynamic>{}),
        ));
    _decodeData(res);
  }

  Future<VaultRecoveryCollectResult> collectRequest({
    required String resetToken,
    required String requestId,
    required String requestingDeviceFingerprint,
  }) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/me/vault-recovery/requests/${Uri.encodeComponent(requestId)}/collect'),
          headers: _headers(),
          body: jsonEncode({
            'resetToken': resetToken,
            'requestingDeviceFingerprint': requestingDeviceFingerprint,
          }),
        ));
    final data = _decodeData(res);
    return VaultRecoveryCollectResult.fromJson(data);
  }

  Future<void> completeRecovery({
    required String resetToken,
    required String requestId,
    required String newPassword,
    required int expectedVaultEpoch,
  }) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/me/vault-recovery/complete'),
          headers: _headers(),
          body: jsonEncode({
            'resetToken': resetToken,
            'requestId': requestId,
            'newPassword': newPassword,
            'expectedVaultEpoch': expectedVaultEpoch,
          }),
        ));
    _decodeData(res);
  }

  /// Upload re-protected vault during trusted-device recovery (public, reset-token auth).
  Future<EncryptedVaultEnvelope> upsertVaultForRecovery({
    required String resetToken,
    required String requestId,
    required VaultUploadPayload payload,
    String? deviceId,
  }) async {
    _ensureConfigured();
    final body = <String, Object?>{
      ...payload.toJson(),
      'resetToken': resetToken,
      'requestId': requestId,
      if (deviceId != null && deviceId.isNotEmpty) 'deviceId': deviceId,
    };
    final res = await _send(() => _http.put(
          _endpoint('/api/v1/vault/recovery'),
          headers: _headers(),
          body: jsonEncode(body),
        ));
    final data = _decodeData(res);
    return EncryptedVaultEnvelope.fromJson(data);
  }

  /// Fetch encrypted vault envelope during recovery when a session is available.
  Future<EncryptedVaultEnvelope?> getVaultDuringRecovery({
    String? accessToken,
    required String resetToken,
    required String requestId,
  }) async {
    _ensureConfigured();
    if (accessToken != null && accessToken.isNotEmpty) {
      final res = await _send(() => _http.get(
            _endpoint('/api/v1/vault'),
            headers: _headers(bearer: accessToken),
          ));
      if (res.statusCode == 404) return null;
      final data = _decodeData(res);
      if (data.isEmpty) return null;
      return EncryptedVaultEnvelope.fromJson(data);
    }
    try {
      final uri = _endpoint('/api/v1/vault/recovery').replace(
        queryParameters: {
          'resetToken': resetToken,
          'requestId': requestId,
        },
      );
      final res = await _send(() => _http.get(uri, headers: _headers()));
      if (res.statusCode == 404) return null;
      final data = _decodeData(res);
      if (data.isEmpty) return null;
      return EncryptedVaultEnvelope.fromJson(data);
    } on AuthException {
      return null;
    }
  }

  /// Registered public wallet addresses for mismatch checks during emergency recovery.
  Future<List<String>> listRegisteredAddresses(String accessToken) async {
    _ensureConfigured();
    final res = await _send(() => _http.get(
          _endpoint('/api/v1/wallets'),
          headers: _headers(bearer: accessToken),
        ));
    final body = _decodeBody(res);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      return const [];
    }
    final data = body['data'];
    final items = data is Map ? data['items'] : null;
    if (items is! List) return const [];
    final out = <String>[];
    for (final item in items) {
      if (item is! Map) continue;
      final address = (item['address'] ?? item['publicAddress'] ?? '').toString().trim();
      if (address.isNotEmpty) out.add(address.toLowerCase());
    }
    return out;
  }

  void dispose() => _http.close();
}
