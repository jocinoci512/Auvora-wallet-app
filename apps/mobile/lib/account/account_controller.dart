import 'package:flutter/foundation.dart';

import 'auth_api_client.dart';
import 'auth_token_store.dart';

enum AccountStatus { unknown, signedOut, authenticating, signedIn }

/// Owns Auvora *account* (backend identity) state for the mobile app.
///
/// Separate from the on-device non-custodial wallet: signing in or out here
/// never uploads or deletes wallet secrets. Logout clears account tokens only.
class AccountController extends ChangeNotifier {
  AccountController({AuthApiClient? client, AuthTokenStore? store})
      : _client = client ?? AuthApiClient(),
        _store = store ?? AuthTokenStore();

  final AuthApiClient _client;
  final AuthTokenStore _store;

  AccountStatus _status = AccountStatus.unknown;
  AuthProfile? _profile;
  String? _error;
  bool _busy = false;

  AccountStatus get status => _status;
  AuthProfile? get profile => _profile;
  String? get error => _error;
  bool get busy => _busy;
  bool get isConfigured => _client.isConfigured;
  bool get isSignedIn => _status == AccountStatus.signedIn;

  /// Restore a prior session on app start (refresh if the access token expired).
  Future<void> bootstrap() async {
    if (!isConfigured) {
      _set(status: AccountStatus.signedOut);
      return;
    }
    final access = await _store.readAccessToken();
    if (access == null || access.isEmpty) {
      _set(status: AccountStatus.signedOut);
      return;
    }
    try {
      _profile = await _client.currentUser(access);
      _set(status: AccountStatus.signedIn);
    } on AuthException catch (e) {
      if (e.kind == AuthErrorKind.invalidCredentials) {
        final refreshed = await _tryRefresh();
        if (refreshed) return;
      }
      await _store.clear();
      _set(status: AccountStatus.signedOut);
    }
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _store.readRefreshToken();
    if (refresh == null || refresh.isEmpty) return false;
    try {
      final session = await _client.refresh(refresh);
      await _store.saveSession(
        accessToken: session.accessToken,
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
      );
      _profile = await _client.currentUser(session.accessToken);
      _set(status: AccountStatus.signedIn);
      return true;
    } on AuthException {
      await _store.clear();
      _set(status: AccountStatus.signedOut);
      return false;
    }
  }

  /// Create an account, then sign in with the same credentials.
  Future<bool> register({
    required String email,
    required String username,
    required String password,
    String? firstName,
    String? lastName,
  }) async {
    return _guard(() async {
      await _client.register(
        email: email,
        username: username,
        password: password,
        firstName: firstName,
        lastName: lastName,
      );
      return _loginInternal(email: email, password: password);
    });
  }

  Future<bool> signIn({required String email, required String password}) async {
    return _guard(() => _loginInternal(email: email, password: password));
  }

  Future<bool> _loginInternal({required String email, required String password}) async {
    final fp = await _store.deviceFingerprint();
    final session = await _client.login(
      email: email,
      password: password,
      deviceFingerprint: fp,
      deviceName: 'Android device',
    );
    await _store.saveSession(
      accessToken: session.accessToken,
      sessionId: session.sessionId,
      refreshToken: session.refreshToken,
    );
    final profile = await _client.currentUser(session.accessToken);
    await _store.saveIdentity(id: profile.id, email: profile.email, username: profile.username);
    _profile = profile;
    return true;
  }

  /// Sign out: revoke the backend session (best-effort) and clear local tokens.
  /// The on-device wallet vault is deliberately left intact.
  Future<void> signOut() async {
    final access = await _store.readAccessToken();
    if (access != null) {
      await _client.logout(access);
    }
    await _store.clear();
    _profile = null;
    _set(status: AccountStatus.signedOut);
  }

  Future<bool> _guard(Future<bool> Function() run) async {
    if (!isConfigured) {
      _error = 'Account backend is not configured for this build.';
      _set(status: AccountStatus.signedOut);
      return false;
    }
    _busy = true;
    _error = null;
    _set(status: AccountStatus.authenticating);
    try {
      final ok = await run();
      _busy = false;
      _set(status: ok ? AccountStatus.signedIn : AccountStatus.signedOut);
      return ok;
    } on AuthException catch (e) {
      _error = e.message;
      _busy = false;
      _set(status: AccountStatus.signedOut);
      return false;
    }
  }

  void _set({required AccountStatus status}) {
    _status = status;
    notifyListeners();
  }

  @override
  void dispose() {
    _client.dispose();
    super.dispose();
  }
}
