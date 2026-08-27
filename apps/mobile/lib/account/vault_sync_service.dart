import 'package:flutter/foundation.dart';

import '../state/wallet_controller.dart';
import 'account_controller.dart';
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

  bool get busy => _busy;
  String? get lastError => _lastError;
  String? get lastStatus => _lastStatus;
  DateTime? get lastSuccessAt => _lastSuccessAt;
  int? get remoteEpoch => _remoteEpoch;
  bool get isConfigured => _client.isConfigured;
  bool get needsPasswordForUpload => _needsPasswordForUpload;
  bool get needsPasswordForRestore => _needsPasswordForRestore;

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
        _lastStatus = 'Cloud vault available — enter account password to restore';
      } else if (!localEmpty && wallet.unlocked && remote == null) {
        _needsPasswordForUpload = true;
        _needsPasswordForRestore = false;
        _lastStatus = 'Ready to upload encrypted vault';
      } else if (!localEmpty && wallet.unlocked && remote != null) {
        _needsPasswordForUpload = false;
        _needsPasswordForRestore = false;
        _lastStatus = 'Cloud vault current (epoch ${remote.epoch})';
      } else {
        _needsPasswordForUpload = false;
        _needsPasswordForRestore = false;
      }
      _lastError = null;
      notifyListeners();
    } on AuthException catch (e) {
      _lastError = e.message;
      notifyListeners();
    } catch (_) {
      _lastError = 'Could not check encrypted vault status.';
      notifyListeners();
    }
  }

  /// Encrypt local wallets and PUT `/api/v1/vault`.
  Future<bool> uploadLocalVault({
    required AccountController account,
    required WalletController wallet,
    required String password,
  }) async {
    if (!account.isSignedIn || !wallet.unlocked) return false;
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
          'No local recovery phrases available to encrypt.',
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

      final deviceId = await _tokenStore.deviceFingerprint();
      final stored = await _client.upsertVault(
        accessToken: token,
        payload: payload,
        deviceId: deviceId,
      );
      _remoteEpoch = stored.epoch;
      _lastSuccessAt = DateTime.now();
      _lastStatus = 'Encrypted vault uploaded (epoch ${stored.epoch})';
      _needsPasswordForUpload = false;
      _lastError = null;
      return true;
    } on AuthException catch (e) {
      _lastError = e.message;
      return false;
    } catch (_) {
      _lastError = 'Encrypted vault upload failed. Check your password and try again.';
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Download remote vault, decrypt with account password, and import locally.
  Future<bool> restoreFromCloud({
    required AccountController account,
    required WalletController wallet,
    required String password,
  }) async {
    if (!account.isSignedIn) return false;
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
          'No encrypted vault is stored for this account yet.',
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
      _lastStatus = 'Encrypted vault restored ($imported wallet(s))';
      _needsPasswordForRestore = false;
      _lastError = null;
      return imported > 0;
    } on AuthException catch (e) {
      _lastError = e.message;
      return false;
    } catch (_) {
      _lastError =
          'Could not decrypt the cloud vault. Check your account password (or re-wrap with recovery phrase after a password reset).';
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
