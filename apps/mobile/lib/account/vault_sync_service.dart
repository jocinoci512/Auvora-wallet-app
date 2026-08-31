import 'package:flutter/foundation.dart';

import '../state/wallet_controller.dart';
import 'account_controller.dart';
import 'account_password_session.dart';
import 'auth_api_client.dart';
import 'auth_token_store.dart';
import 'vault_client.dart';
import 'vault_crypto.dart';

/// Cross-device encrypted vault sync (ciphertext only — never plaintext to server).
///
/// Password reset note: changing the Auvora account password does **not** decrypt
/// an existing vault. Clients must re-wrap with the recovery phrase
/// ([rewrapVaultWithNewPassword]) and PUT a new epoch.
class VaultSyncService extends ChangeNotifier {
  VaultSyncService({
    VaultClient? client,
    AuthTokenStore? tokenStore,
  })  : _client = client ?? VaultClient(),
        _tokenStore = tokenStore ?? AuthTokenStore();

  final VaultClient _client;
  final AuthTokenStore _tokenStore;

  bool _busy = false;
  String? _lastError;
  String? _lastStatus;
  DateTime? _lastSuccessAt;
  int? _remoteEpoch;
  bool _needsPasswordForUpload = false;
  bool _needsPasswordForRestore = false;
  bool _backupIncomplete = false;
  int _autoUploadAttempts = 0;

  bool get busy => _busy;
  String? get lastError => _lastError;
  String? get lastStatus => _lastStatus;
  DateTime? get lastSuccessAt => _lastSuccessAt;
  int? get remoteEpoch => _remoteEpoch;
  bool get isConfigured => _client.isConfigured;
  bool get needsPasswordForUpload => _needsPasswordForUpload;
  bool get needsPasswordForRestore => _needsPasswordForRestore;
  /// True when local wallet exists but cloud ciphertext is missing after retries.
  bool get backupIncomplete => _backupIncomplete;

  void clearPasswordFlags() {
    _needsPasswordForUpload = false;
    _needsPasswordForRestore = false;
    notifyListeners();
  }

  /// Inspect local vs remote and set password-needed flags (no crypto yet).
  Future<void> reconcileFlags({
    required AccountController account,
    required WalletController wallet,
  }) async {
    if (!account.isConfigured || !account.isSignedIn) return;
    if (!isConfigured) return;

    try {
      final token = await account.readAccessToken();
      if (token == null || token.isEmpty) return;
      final remote = await _client.getVault(accessToken: token);
      _remoteEpoch = remote?.epoch;
      final localEmpty = wallet.vaults.isEmpty && wallet.wallet == null;

      if (localEmpty && remote != null) {
        _needsPasswordForRestore = true;
        _needsPasswordForUpload = false;
        _backupIncomplete = false;
        _lastStatus = 'Cloud backup available — confirm your password to unlock';
      } else if (!localEmpty && wallet.unlocked && remote == null) {
        _needsPasswordForUpload = true;
        _needsPasswordForRestore = false;
        _backupIncomplete = true;
        _lastStatus = 'Confirm your Auvora password once to finish secure backup';
      } else if (!localEmpty && wallet.unlocked && remote != null) {
        _needsPasswordForUpload = false;
        _needsPasswordForRestore = false;
        _backupIncomplete = false;
        _lastStatus = 'Secure backup complete';
      } else {
        _needsPasswordForUpload = false;
        _needsPasswordForRestore = false;
      }
      _lastError = null;
      notifyListeners();

      // Happy path: auto-upload after first-device wallet create without a second prompt.
      if (_needsPasswordForUpload && !_busy) {
        await tryAutoUpload(account: account, wallet: wallet);
      }
      // Happy path: auto-restore on a second device when local wallet is empty.
      if (_needsPasswordForRestore && !_busy && AccountPasswordSession.peek() != null) {
        await tryAutoRestore(account: account, wallet: wallet);
      }
    } on AuthException catch (e) {
      _lastError = e.message;
      notifyListeners();
    } catch (_) {
      _lastError = 'Could not check encrypted vault status.';
      notifyListeners();
    }
  }

  /// Upload using [AccountPasswordSession] when present (no UI prompt).
  Future<bool> tryAutoUpload({
    required AccountController account,
    required WalletController wallet,
  }) async {
    final password = AccountPasswordSession.peek();
    if (password == null || password.isEmpty) {
      _lastStatus =
          'Confirm your Auvora password once to finish secure backup for other devices.';
      notifyListeners();
      return false;
    }
    if (_autoUploadAttempts >= 3) {
      _backupIncomplete = true;
      _lastStatus =
          'Wallet works on this device, but secure cloud backup is incomplete. Retry from Account.';
      notifyListeners();
      return false;
    }
    _autoUploadAttempts += 1;
    final ok = await uploadLocalVault(
      account: account,
      wallet: wallet,
      password: password,
    );
    if (ok) {
      AccountPasswordSession.clear();
      _autoUploadAttempts = 0;
      _backupIncomplete = false;
    } else {
      _backupIncomplete = true;
      _lastStatus ??=
          'Wallet works on this device, but secure cloud backup is incomplete. Retry from Account.';
    }
    return ok;
  }

  /// Restore using [AccountPasswordSession] when present (no UI prompt).
  Future<bool> tryAutoRestore({
    required AccountController account,
    required WalletController wallet,
  }) async {
    final password = AccountPasswordSession.peek();
    if (password == null || password.isEmpty) return false;
    final ok = await restoreFromCloud(
      account: account,
      wallet: wallet,
      password: password,
    );
    if (ok) {
      AccountPasswordSession.clear();
    }
    return ok;
  }

  /// Encrypt local wallets and PUT `/api/v1/vault`.
  Future<bool> uploadLocalVault({
    required AccountController account,
    required WalletController wallet,
    required String password,
  }) async {
    if (!account.isSignedIn || !wallet.unlocked) return false;
    if (_busy) return false;
    final ownerId = account.profile?.id;
    if (ownerId == null || ownerId.isEmpty) return false;

    _busy = true;
    _lastError = null;
    notifyListeners();

    try {
      final token = await account.readAccessToken();
      if (token == null || token.isEmpty) {
        throw const AuthException(
          AuthErrorKind.forbidden,
          'Sign in is required before encrypted vault sync.',
        );
      }

      final entries = await wallet.buildVaultPlaintextEntries();
      if (entries.isEmpty) {
        throw const AuthException(
          AuthErrorKind.unknown,
          'No wallets available to back up on this device.',
        );
      }

      final remote = await _client.getVault(accessToken: token);
      final nextEpoch = (remote?.epoch ?? 0) + 1;
      final recoveryPhrase = entries.first.mnemonic;

      final payload = await encryptVaultBundle(
        ownerUserId: ownerId,
        epoch: nextEpoch,
        password: password,
        recoveryPhrase: recoveryPhrase,
        bundle: VaultPlaintextBundle(wallets: entries),
      );

      final deviceFingerprint = await _tokenStore.deviceFingerprint();
      // Wallet API `deviceId` must be a UUID (devices.id). Android fingerprints are
      // `and-<uuid>` and must NOT be sent as deviceId — that caused HTTP 400
      // "Encrypted vault payload was rejected."
      final stored = await _client.upsertVault(
        accessToken: token,
        payload: payload,
        deviceId: _uuidOrNull(deviceFingerprint),
      );
      _remoteEpoch = stored.epoch;
      _lastSuccessAt = DateTime.now();
      _lastStatus = 'Secure backup complete';
      _needsPasswordForUpload = false;
      _backupIncomplete = false;
      _lastError = null;
      AccountPasswordSession.clear();
      return true;
    } on AuthException catch (e) {
      _lastError = _customerFacingVaultError(e);
      _backupIncomplete = true;
      return false;
    } catch (_) {
      _lastError =
          'Secure backup could not be completed. Please try again.';
      _backupIncomplete = true;
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  static String _customerFacingVaultError(AuthException e) {
    if (e.kind == AuthErrorKind.network ||
        e.kind == AuthErrorKind.timeout ||
        e.kind == AuthErrorKind.server) {
      return 'Secure backup could not be completed. Please try again.';
    }
    return e.message;
  }

  /// Download remote vault, decrypt with account password, and import locally.
  Future<bool> restoreFromCloud({
    required AccountController account,
    required WalletController wallet,
    required String password,
  }) async {
    if (!account.isSignedIn) return false;
    if (_busy) return false;
    final ownerId = account.profile?.id;
    if (ownerId == null || ownerId.isEmpty) return false;

    _busy = true;
    _lastError = null;
    notifyListeners();

    try {
      final token = await account.readAccessToken();
      if (token == null || token.isEmpty) {
        throw const AuthException(
          AuthErrorKind.forbidden,
          'Sign in is required before encrypted vault restore.',
        );
      }

      final remote = await _client.getVault(accessToken: token);
      if (remote == null || remote.epoch == null) {
        throw const AuthException(
          AuthErrorKind.unknown,
          'No secure backup is stored for this account yet.',
        );
      }

      final bundle = await decryptVaultBundle(
        ownerUserId: ownerId,
        envelope: remote,
        epoch: remote.epoch!,
        password: password,
      );

      final imported = await wallet.importEncryptedVaultBundle(bundle);
      _remoteEpoch = remote.epoch;
      _lastSuccessAt = DateTime.now();
      _lastStatus = 'Wallet unlocked from secure backup';
      _needsPasswordForRestore = false;
      _lastError = null;
      AccountPasswordSession.clear();
      return imported > 0;
    } on AuthException catch (e) {
      _lastError = _customerFacingVaultError(e);
      return false;
    } catch (_) {
      _lastError = 'Incorrect password. Please try again.';
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}

/// Wallet `deviceId` must be a bare UUID. Android fingerprints are `and-<uuid>`
/// and must be omitted (not coerced) so ValidationPipe does not 400 the upload.
String? _uuidOrNull(String? value) {
  if (value == null) return null;
  final v = value.trim();
  final uuidRe = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );
  return uuidRe.hasMatch(v) ? v : null;
}
