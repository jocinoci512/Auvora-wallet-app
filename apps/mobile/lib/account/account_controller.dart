import 'package:flutter/foundation.dart';

import '../release/network_env.dart';
import '../state/wallet_session_restore.dart';
import 'auth_api_client.dart';
import 'auth_token_store.dart';
import 'auvora_api_config.dart';
import 'auvora_connectivity.dart';

enum AccountStatus { unknown, signedOut, authenticating, signedIn, sessionExpired }

/// Owns Auvora *account* (backend identity) state for the mobile app.
///
/// Separate from the on-device non-custodial wallet: signing in or out here
/// never uploads or deletes wallet secrets. Logout clears account tokens only.
class AccountController extends ChangeNotifier {
  AccountController({
    AuthApiClient? client,
    AuthTokenStore? store,
    Future<bool> Function()? gatewayReachable,
  })  : _client = client ?? AuthApiClient(),
        _store = store ?? AuthTokenStore(),
        _gatewayReachable = gatewayReachable ?? AuvoraConnectivity.gatewayReachable;

  final AuthApiClient _client;
  final AuthTokenStore _store;
  final Future<bool> Function() _gatewayReachable;

  AccountStatus _status = AccountStatus.unknown;
  AuthProfile? _profile;
  String? _error;
  bool _busy = false;
  AuvoraLinkState _linkState = AuvoraLinkState.online;

  AccountStatus get status => _status;
  AuthProfile? get profile => _profile;
  String? get error => _error;
  bool get busy => _busy;
  AuvoraLinkState get linkState => _linkState;

  /// True when [error] is a sticky transport failure, not a credential problem.
  bool get hasTransportError =>
      _error != null &&
      (_linkState == AuvoraLinkState.offline || _linkState == AuvoraLinkState.degraded);

  /// Clear a stale offline/degraded banner after another authenticated API call succeeds.
  void noteAuthenticatedSuccess() {
    if (_error == null && _linkState == AuvoraLinkState.online) return;
    _error = null;
    _linkState = AuvoraLinkState.online;
    notifyListeners();
  }
  bool get isConfigured => _client.isConfigured;
  bool get isSignedIn => _status == AccountStatus.signedIn;
  bool get isSessionExpired => _status == AccountStatus.sessionExpired;

  Future<String?> readAccessToken() => _store.readAccessToken();

  /// LOCAL QA ONLY. Expires the access token without touching the refresh session.
  Future<void> markAccessExpiredForQa() async {
    if (!AuvoraApiConfig.allowLocalApi || !AuvoraNetworkEnv.isTestnet) return;
    await _store.markAccessExpiredForLocalQa();
  }

  /// Access token for API calls. Refreshes first when the stored access token
  /// is missing or past its persisted expiry. Never prompts for a password.
  Future<String?> ensureAccessToken() async {
    final access = await _store.readAccessToken();
    if (access != null && access.isNotEmpty && !await _store.accessExpired) {
      return access;
    }
    if (!await _tryRefresh()) return null;
    final next = await _store.readAccessToken();
    if (next == null || next.isEmpty) return null;
    return next;
  }

  static bool _isTransient(AuthException e) =>
      e.kind == AuthErrorKind.network ||
      e.kind == AuthErrorKind.timeout ||
      e.kind == AuthErrorKind.server ||
      e.kind == AuthErrorKind.rateLimited;

  /// Restore a prior session on app start (refresh if the access token expired).
  ///
  /// Transient network/server failures keep tokens so the user is not signed
  /// out just because the device is offline. Invalid/revoked refresh still
  /// returns safely to signed-out (no login loop).
  Future<void> bootstrap() async {
    if (!isConfigured) {
      _set(status: AccountStatus.signedOut);
      return;
    }
    final access = await _store.readAccessToken();
    final hasRefresh = await _store.hasRefreshSession;
    if ((access == null || access.isEmpty) && !hasRefresh) {
      await _signOutAuthOnly(expired: await _store.readUserId() != null);
      return;
    }
    if (access == null || access.isEmpty || await _store.accessExpired) {
      await _tryRefresh();
      return;
    }
    try {
      _profile = await _client.currentUser(access);
      _error = null;
      _linkState = AuvoraLinkState.online;
      _set(status: AccountStatus.signedIn);
    } on AuthException catch (e) {
      if (e.kind == AuthErrorKind.invalidCredentials || e.kind == AuthErrorKind.forbidden) {
        await _tryRefresh();
        return;
      }
      if (_isTransient(e)) {
        await _restoreCachedSignedIn(e.message, e.kind);
        return;
      }
      await _signOutAuthOnly(expired: true);
    }
  }

  /// Re-check the backend session after resume / reconnect. Never wipes tokens
  /// on a transport failure.
  Future<void> revalidate() async {
    if (!isConfigured || _busy) return;
    if (await _store.accessExpired) {
      await _tryRefresh();
      return;
    }
    final access = await _store.readAccessToken();
    if (access == null || access.isEmpty) return;
    try {
      _linkState = AuvoraLinkState.connecting;
      notifyListeners();
      if (await _gatewayReachable()) {
        _profile = await _client.currentUser(access);
        _error = null;
        _linkState = AuvoraLinkState.online;
        _set(status: AccountStatus.signedIn);
        return;
      }
      _profile = await _client.currentUser(access);
      _error = null;
      _linkState = AuvoraLinkState.online;
      _set(status: AccountStatus.signedIn);
    } on AuthException catch (e) {
      if (e.kind == AuthErrorKind.invalidCredentials || e.kind == AuthErrorKind.forbidden) {
        await _tryRefresh();
        return;
      }
      if (_isTransient(e)) {
        final gatewayUp = await _gatewayReachable();
        if (gatewayUp) {
          // Gateway is up — do not keep a false "offline" banner.
          _error = null;
          _linkState = AuvoraLinkState.online;
          notifyListeners();
          return;
        }
        _error = e.kind == AuthErrorKind.timeout
            ? AuvoraConnectivity.degradedMessage
            : AuvoraConnectivity.offlineMessage;
        _linkState =
            e.kind == AuthErrorKind.timeout ? AuvoraLinkState.degraded : AuvoraLinkState.offline;
        notifyListeners();
      }
    }
  }

  Future<bool> _tryRefresh() async {
    final refresh = await _store.readRefreshToken();
    if (refresh == null || refresh.isEmpty) {
      await _signOutAuthOnly(expired: true);
      return false;
    }
    try {
      final session = await _client.refresh(refresh);
      await _store.saveSession(
        accessToken: session.accessToken,
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      );
      _profile = await _client.currentUser(session.accessToken);
      _error = null;
      _linkState = AuvoraLinkState.online;
      _set(status: AccountStatus.signedIn);
      return true;
    } on AuthException catch (e) {
      if (_isTransient(e)) {
        await _restoreCachedSignedIn(e.message, e.kind);
        return true;
      }
      await _signOutAuthOnly(expired: true);
      return false;
    }
  }

  /// Clear account tokens only. Never touches wallet / vault keys.
  Future<void> _signOutAuthOnly({required bool expired}) async {
    await _store.clear();
    _profile = null;
    if (expired) {
      _error = WalletSessionRestore.sessionExpiredMessage;
      _set(status: AccountStatus.sessionExpired);
      return;
    }
    _set(status: AccountStatus.signedOut);
  }

  Future<void> _restoreCachedSignedIn(String message, AuthErrorKind kind) async {
    final id = await _store.readUserId();
    final email = await _store.readEmail();
    final username = await _store.readUsername();
    if (id != null && id.isNotEmpty) {
      _profile = AuthProfile(id: id, email: email ?? '', username: username ?? '');
    }
    final gatewayUp = await _gatewayReachable();
    if (gatewayUp) {
      _error = null;
      _linkState = AuvoraLinkState.online;
      _set(status: AccountStatus.signedIn);
      return;
    }
    _error = kind == AuthErrorKind.timeout
        ? AuvoraConnectivity.degradedMessage
        : AuvoraConnectivity.offlineMessage;
    _linkState = kind == AuthErrorKind.timeout ? AuvoraLinkState.degraded : AuvoraLinkState.offline;
    _set(status: AccountStatus.signedIn);
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

  /// Confirm the account password without signing the user out on failure.
  ///
  /// Used by secure-backup / unlock flows. Wrong password returns false and
  /// leaves the existing session intact.
  Future<bool> confirmPassword(String password) async {
    final email = _profile?.email;
    if (!isSignedIn || email == null || email.isEmpty) return false;
    final trimmed = password.trim();
    if (trimmed.isEmpty) return false;
    try {
      final fp = await _store.deviceFingerprint();
      final session = await _client.login(
        email: email,
        password: trimmed,
        deviceFingerprint: fp,
        deviceName: 'Android device',
      );
      await _store.saveSession(
        accessToken: session.accessToken,
        sessionId: session.sessionId,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      );
      return true;
    } on AuthException catch (e) {
      if (e.kind == AuthErrorKind.invalidCredentials || e.kind == AuthErrorKind.forbidden) {
        return false;
      }
      rethrow;
    }
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
      expiresIn: session.expiresIn,
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
    _linkState = AuvoraLinkState.online;
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
