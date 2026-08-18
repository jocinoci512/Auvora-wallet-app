import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'auvora_api_config.dart';

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
    } on TimeoutException {
      throw const AuthException(AuthErrorKind.timeout, 'The request timed out. Please try again.');
    } catch (_) {
      throw const AuthException(
        AuthErrorKind.network,
        'No internet connection. Check your connection and try again.',
      );
    }
  }

  Map<String, dynamic> _decodeData(http.Response res) {
    Map<String, dynamic> body;
    try {
      final decoded = jsonDecode(res.body);
      body = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
    } catch (_) {
      body = <String, dynamic>{};
    }
    if (res.statusCode >= 200 && res.statusCode < 300) {
      final data = body['data'];
      return data is Map<String, dynamic> ? data : body;
    }
    throw _mapError(res.statusCode);
  }

  AuthException _mapError(int status) {
    switch (status) {
      case 400:
      case 422:
        return const AuthException(AuthErrorKind.invalidCredentials, 'Please check the details you entered.');
      case 401:
        return const AuthException(AuthErrorKind.invalidCredentials, 'Invalid email or password.');
      case 403:
        return const AuthException(
          AuthErrorKind.forbidden,
          'This account is not permitted to sign in. Verify your email or contact support.',
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

  void dispose() => _http.close();
}
