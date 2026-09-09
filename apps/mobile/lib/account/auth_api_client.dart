import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auvora_api_config.dart';
import 'auvora_connectivity.dart';

/// Why an auth call failed, mapped to a safe, user-facing category.
enum AuthErrorKind {
  notConfigured,
  network,
  timeout,
  invalidCredentials,
  forbidden,
  emailNotVerified,
  conflict,
  rateLimited,
  server,
  unknown,
}

/// Never carries raw server payloads — only a safe category + friendly message.
class AuthException implements Exception {
  const AuthException(this.kind, this.message);
  final AuthErrorKind kind;
  final String message;
  @override
  String toString() => 'AuthException($kind): $message';
}

/// Authenticated session material returned by login/refresh.
class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.expiresIn,
    required this.sessionId,
    this.refreshToken,
  });

  final String accessToken;
  final int expiresIn;
  final String sessionId;

  /// Present for native clients (returned in the body by the backend).
  final String? refreshToken;
}

/// Safe, non-secret account profile fields.
class AuthProfile {
  const AuthProfile({
    required this.id,
    required this.email,
    required this.username,
    this.firstName,
    this.lastName,
    this.status,
    this.emailVerified = false,
  });

  final String id;
  final String email;
  final String username;
  final String? firstName;
  final String? lastName;
  final String? status;
  final bool emailVerified;

  factory AuthProfile.fromJson(Map<String, dynamic> json) => AuthProfile(
        id: (json['id'] ?? '').toString(),
        email: (json['email'] ?? '').toString(),
        username: (json['username'] ?? '').toString(),
        firstName: json['firstName'] as String?,
        lastName: json['lastName'] as String?,
        status: json['status'] as String?,
        emailVerified: json['emailVerified'] == true,
      );
}

/// Thin HTTP client for the Auvora account/auth API via the Gateway.
///
/// Sends only account credentials + coarse device metadata. NEVER sends wallet
/// secrets (mnemonic / private key / seed / vault) — those stay on-device.
class AuthApiClient {
  AuthApiClient({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
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
    } on AuthException {
      rethrow;
    } catch (error) {
      throw AuvoraConnectivity.fromTransportOrUnknown(error);
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

  /// Handles list payloads where `data` is a [List] or `{ items: [...] }`.
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
    if (data is Map) {
      final items = data['items'];
      if (items is List) {
        return [
          for (final item in items)
            if (item is Map) Map<String, dynamic>.from(item),
        ];
      }
    }
    final topItems = body['items'];
    if (topItems is List) {
      return [
        for (final item in topItems)
          if (item is Map) Map<String, dynamic>.from(item),
      ];
    }
    return const [];
  }

  AuthException _mapError(int status, [Map<String, dynamic>? body]) {
    final serverMessage = () {
      final err = body?['error'];
      if (err is Map && err['message'] is String) {
        return (err['message'] as String).trim();
      }
      return '';
    }();
    final lower = serverMessage.toLowerCase();

    switch (status) {
      case 400:
      case 422:
        return const AuthException(AuthErrorKind.invalidCredentials, 'Please check the details you entered.');
      case 401:
        return const AuthException(AuthErrorKind.invalidCredentials, 'Invalid email or password.');
      case 403:
        if (lower.contains('verif')) {
          return const AuthException(
            AuthErrorKind.emailNotVerified,
            'Verify your email before signing in. Check your inbox, then try again.',
          );
        }
        return const AuthException(
          AuthErrorKind.forbidden,
          'This account is not permitted to sign in. Contact support if you need help.',
        );
      case 409:
        return const AuthException(AuthErrorKind.conflict, 'An account with these details already exists.');
      case 423:
        return const AuthException(AuthErrorKind.forbidden, 'Account temporarily locked. Try again later.');
      case 404:
        return const AuthException(AuthErrorKind.unknown, 'That resource was not found. Please try again.');
      case 429:
        return const AuthException(AuthErrorKind.rateLimited, 'Too many attempts. Please wait and try again.');
      default:
        if (status >= 500) {
          return const AuthException(
            AuthErrorKind.server,
            'Auvora is having trouble. Please try again shortly.',
          );
        }
        return const AuthException(AuthErrorKind.unknown, 'Something went wrong. Please try again.');
    }
  }

  /// Register a new Auvora account. Returns the new user id.
  Future<String> register({
    required String email,
    required String username,
    required String password,
    String? firstName,
    String? lastName,
  }) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/auth/register'),
          headers: _headers(),
          body: jsonEncode({
            'email': email,
            'username': username,
            'password': password,
            if (firstName != null && firstName.isNotEmpty) 'firstName': firstName,
            if (lastName != null && lastName.isNotEmpty) 'lastName': lastName,
          }),
        ));
    final data = _decodeData(res);
    return (data['userId'] ?? '').toString();
  }

  /// Sign in. `devicePlatform=android` makes the backend attribute the platform
  /// and return the refresh token in the body (native clients can't use cookies).
  Future<AuthSession> login({
    required String email,
    required String password,
    required String deviceFingerprint,
    String? deviceName,
    String? appVersion,
  }) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/auth/login'),
          headers: _headers(),
          body: jsonEncode({
            'email': email,
            'password': password,
            'deviceFingerprint': deviceFingerprint,
            'devicePlatform': AuvoraApiConfig.platform,
            if (deviceName != null && deviceName.isNotEmpty) 'deviceName': deviceName,
            if (appVersion != null && appVersion.isNotEmpty) 'appVersion': appVersion,
          }),
        ));
    final data = _decodeData(res);
    return AuthSession(
      accessToken: (data['accessToken'] ?? '').toString(),
      expiresIn: (data['expiresIn'] is num) ? (data['expiresIn'] as num).toInt() : 0,
      sessionId: (data['sessionId'] ?? '').toString(),
      refreshToken: data['refreshToken'] as String?,
    );
  }

  /// Rotate tokens using the stored refresh token (sent in the body).
  Future<AuthSession> refresh(String refreshToken) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/auth/refresh'),
          headers: _headers(),
          body: jsonEncode({'refreshToken': refreshToken}),
        ));
    final data = _decodeData(res);
    return AuthSession(
      accessToken: (data['accessToken'] ?? '').toString(),
      expiresIn: (data['expiresIn'] is num) ? (data['expiresIn'] as num).toInt() : 0,
      sessionId: (data['sessionId'] ?? '').toString(),
      refreshToken: data['refreshToken'] as String?,
    );
  }

  /// Fetch the authenticated account profile (safe fields only).
  Future<AuthProfile> currentUser(String accessToken) async {
    _ensureConfigured();
    final res = await _send(() => _http.get(
          _endpoint('/api/v1/me'),
          headers: _headers(bearer: accessToken),
        ));
    final data = _decodeData(res);
    return AuthProfile.fromJson(data);
  }

  /// Request a password reset email. Enumeration-safe on the backend (always
  /// returns success), so callers show a generic confirmation.
  Future<void> forgotPassword(String email) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/auth/forgot-password'),
          headers: _headers(),
          body: jsonEncode({'email': email}),
        ));
    _decodeData(res);
  }

  /// Resend email verification. Enumeration-safe on the backend.
  Future<void> resendVerification(String email) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/auth/resend-verification'),
          headers: _headers(),
          body: jsonEncode({'email': email.trim()}),
        ));
    _decodeData(res);
  }

  /// Best-effort backend session termination. Local credentials are cleared by
  /// the caller regardless of the result.
  Future<void> logout(String accessToken) async {
    if (!isConfigured || accessToken.isEmpty) return;
    try {
      await _http
          .post(_endpoint('/api/v1/auth/logout'), headers: _headers(bearer: accessToken))
          .timeout(timeout);
    } catch (_) {
      // Ignore — logout must always succeed locally.
    }
  }

  Future<List<Map<String, dynamic>>> listDevices(String bearer) async {
    _ensureConfigured();
    final res = await _send(() => _http.get(
          _endpoint('/api/v1/me/devices'),
          headers: _headers(bearer: bearer),
        ));
    return _decodeList(res);
  }

  Future<void> revokeDevice(String bearer, String deviceId) async {
    _ensureConfigured();
    final res = await _send(() => _http.delete(
          _endpoint('/api/v1/me/devices/${Uri.encodeComponent(deviceId)}'),
          headers: _headers(bearer: bearer),
        ));
    _decodeData(res);
  }

  Future<List<Map<String, dynamic>>> listSessions(String bearer) async {
    _ensureConfigured();
    final res = await _send(() => _http.get(
          _endpoint('/api/v1/me/sessions'),
          headers: _headers(bearer: bearer),
        ));
    return _decodeList(res);
  }

  Future<void> revokeSession(String bearer, String sessionId) async {
    _ensureConfigured();
    final res = await _send(() => _http.delete(
          _endpoint('/api/v1/me/sessions/${Uri.encodeComponent(sessionId)}'),
          headers: _headers(bearer: bearer),
        ));
    _decodeData(res);
  }

  Future<List<Map<String, dynamic>>> listNotifications(String bearer) async {
    _ensureConfigured();
    final res = await _send(() => _http.get(
          _endpoint('/api/v1/notifications'),
          headers: _headers(bearer: bearer),
        ));
    return _decodeList(res);
  }

  Future<void> markNotificationRead(String bearer, String id) async {
    _ensureConfigured();
    final res = await _send(() => _http.post(
          _endpoint('/api/v1/notifications/${Uri.encodeComponent(id)}/read'),
          headers: _headers(bearer: bearer),
          body: jsonEncode(const <String, dynamic>{}),
        ));
    _decodeData(res);
  }

  void dispose() => _http.close();
}
