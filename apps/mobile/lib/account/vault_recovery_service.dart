import 'dart:async';

import 'package:flutter/foundation.dart';

import '../crypto/hd_derivation.dart';
import '../release/network_env.dart';
import '../state/wallet_controller.dart';
import 'account_controller.dart';
import 'auvora_api_config.dart';
import 'auth_api_client.dart';
import 'auth_token_store.dart';
import 'device_recovery_key_store.dart';
import 'device_wrap.dart';
import 'vault_client.dart';
import 'vault_crypto.dart';
import 'vault_recovery_api.dart';

/// Orchestrates trusted-device and emergency vault recovery flows.
class VaultRecoveryService extends ChangeNotifier {
  VaultRecoveryService({
    VaultRecoveryApi? api,
    VaultClient? vaultClient,
    DeviceRecoveryKeyStore? keyStore,
    AuthTokenStore? tokenStore,
  })  : _api = api ?? VaultRecoveryApi(),
        _vaultClient = vaultClient ?? VaultClient(),
        _keyStore = keyStore ?? DeviceRecoveryKeyStore(),
        _tokenStore = tokenStore ?? AuthTokenStore();

  final VaultRecoveryApi _api;
  final VaultClient _vaultClient;
  final DeviceRecoveryKeyStore _keyStore;
  final AuthTokenStore _tokenStore;

  bool _busy = false;
  String? _lastError;
  String? _lastStatus;
  List<VaultRecoveryRequest> _pending = const [];

  bool get busy => _busy;
  String? get lastError => _lastError;
  String? get lastStatus => _lastStatus;
  List<VaultRecoveryRequest> get pendingRequests => _pending;
  bool get hasPendingRequests => _pending.isNotEmpty;
  bool get isConfigured => _api.isConfigured;

  /// Poll pending recovery requests for the signed-in owner (trusted device).
  Future<void> refreshPending({required AccountController account}) async {
    if (!account.isSignedIn || !isConfigured) {
      _pending = const [];
      notifyListeners();
      return;
    }
    try {
      final token = await account.ensureAccessToken();
      if (token == null || token.isEmpty) return;
      _pending = await _api.listPending(token);
      _lastError = null;
    } on AuthException catch (e) {
      _lastError = e.message;
    } catch (_) {
      _lastError = 'Could not check recovery requests.';
    }
    notifyListeners();
  }

  /// Trusted device: decrypt vault key and approve a pending request.
  Future<bool> approvePendingRequest({
    required AccountController account,
    required VaultRecoveryRequest request,
    required String accountPassword,
  }) async {
    if (_busy) return false;
    final ownerId = account.profile?.id;
    if (ownerId == null || ownerId.isEmpty) return false;
    final recipientPk = request.requestingPublicKey;
    if (recipientPk == null || recipientPk.isEmpty) {
      _lastError = 'Recovery request is missing device credentials.';
      notifyListeners();
      return false;
    }

    _busy = true;
    _lastError = null;
    notifyListeners();

    try {
      final token = await account.ensureAccessToken();
      if (token == null || token.isEmpty) {
        throw const AuthException(AuthErrorKind.forbidden, 'Sign in is required.');
      }
      final envelope = await _vaultClient.getVault(accessToken: token);
      if (envelope == null || envelope.epoch == null) {
        throw const AuthException(AuthErrorKind.unknown, 'No secure backup found for this account.');
      }
      final vaultKey = await extractVaultKeyWithPassword(
        ownerUserId: ownerId,
        envelope: envelope,
        epoch: envelope.epoch!,
        password: accountPassword,
      );
      final wrapped = wrapVaultKeyForDevice(
        vaultKey: vaultKey,
        recipientPublicKey: recipientPk,
        requestId: request.requestId,
        ownerUserId: ownerId,
      );
      final fingerprint = await _tokenStore.deviceFingerprint();
      await _api.approveRequest(
        accessToken: token,
        requestId: request.requestId,
        wrapped: wrapped,
        approvingDeviceId: _uuidOrNull(fingerprint),
      );
      _lastStatus = 'Recovery approved — the other device can finish setup.';
      await refreshPending(account: account);
      return true;
    } on AuthException catch (e) {
      _lastError = e.message;
      return false;
    } catch (_) {
      _lastError = 'Could not approve recovery. Check your account password.';
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  Future<bool> denyPendingRequest({
    required AccountController account,
    required String requestId,
  }) async {
    if (_busy) return false;
    _busy = true;
    _lastError = null;
    notifyListeners();
    try {
      final token = await account.ensureAccessToken();
      if (token == null || token.isEmpty) {
        throw const AuthException(AuthErrorKind.forbidden, 'Sign in is required.');
      }
      await _api.denyRequest(accessToken: token, requestId: requestId);
      _lastStatus = 'Recovery request denied.';
      await refreshPending(account: account);
      return true;
    } on AuthException catch (e) {
      _lastError = e.message;
      return false;
    } catch (_) {
      _lastError = 'Could not deny recovery request.';
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Device B: create recovery request after password-reset email.
  Future<VaultRecoveryRequest?> startDeviceRecovery({
    required String resetToken,
  }) async {
    if (_busy) return null;
    _busy = true;
    _lastError = null;
    _lastStatus = 'Starting trusted-device recovery…';
    notifyListeners();

    try {
      final keyPair = generateDeviceRecoveryKeyPair();
      final fingerprint = await _tokenStore.deviceFingerprint();
      final created = await _api.createRequest(
        resetToken: resetToken.trim(),
        requestingDeviceFingerprint: fingerprint,
        requestingPublicKey: keyPair.publicKey,
        requestingPlatform: AuvoraApiConfig.platform,
      );
      await _keyStore.savePrivateKey(
        requestId: created.requestId,
        privateKeyBase64: keyPair.privateKey,
      );
      _lastStatus = 'Waiting for a trusted device to approve recovery.';
      return created;
    } on AuthException catch (e) {
      _lastError = e.message;
      return null;
    } catch (_) {
      _lastError = 'Could not start recovery.';
      return null;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Device B: poll collect until approved, then rewrap vault and complete.
  Future<bool> finishDeviceRecovery({
    required AccountController account,
    required String resetToken,
    required String requestId,
    required String newPassword,
    Duration pollInterval = const Duration(seconds: 4),
    int maxPollAttempts = 90,
  }) async {
    if (_busy) return false;
    _busy = true;
    _lastError = null;
    notifyListeners();

    try {
      final privateKey = await _keyStore.readPrivateKey(requestId);
      if (privateKey == null || privateKey.isEmpty) {
        throw const AuthException(
          AuthErrorKind.unknown,
          'Recovery keys for this device were not found. Start recovery again.',
        );
      }
      final fingerprint = await _tokenStore.deviceFingerprint();
      VaultRecoveryCollectResult? collected;
      for (var i = 0; i < maxPollAttempts; i++) {
        try {
          collected = await _api.collectRequest(
            resetToken: resetToken.trim(),
            requestId: requestId,
            requestingDeviceFingerprint: fingerprint,
          );
          break;
        } on AuthException catch (e) {
          if (e.message.toLowerCase().contains('approved') ||
              e.message.toLowerCase().contains('not approved')) {
            _lastStatus = 'Waiting for a trusted device to approve…';
            notifyListeners();
            await Future<void>.delayed(pollInterval);
            continue;
          }
          rethrow;
        }
      }
      if (collected == null) {
        throw const AuthException(
          AuthErrorKind.timeout,
          'Recovery timed out waiting for approval.',
        );
      }

      final vaultKey = unwrapVaultKeyForDevice(
        wrapped: collected.wrapped,
        recipientPrivateKey: privateKey,
        requestId: requestId,
        ownerUserId: collected.ownerUserId,
      );

      final accessToken = await account.ensureAccessToken();
      final envelope = await _api.getVaultDuringRecovery(
        accessToken: accessToken,
        resetToken: resetToken.trim(),
        requestId: requestId,
      );
      if (envelope == null || envelope.epoch == null) {
        throw const AuthException(
          AuthErrorKind.unknown,
          'Secure backup envelope could not be loaded. Sign in on this device if possible, then retry.',
        );
      }

      final payload = await rewrapVaultWithVaultKeyAndNewPassword(
        ownerUserId: collected.ownerUserId,
        envelope: envelope,
        epoch: envelope.epoch!,
        vaultKey: vaultKey,
        newPassword: newPassword,
      );

      await _api.upsertVaultForRecovery(
        resetToken: resetToken.trim(),
        requestId: requestId,
        payload: payload,
        deviceId: _uuidOrNull(fingerprint),
      );

      await _api.completeRecovery(
        resetToken: resetToken.trim(),
        requestId: requestId,
        newPassword: newPassword,
        expectedVaultEpoch: payload.epoch,
      );

      await _keyStore.deletePrivateKey(requestId);
      _lastStatus = 'Recovery complete. Sign in with your new password.';
      return true;
    } on AuthException catch (e) {
      _lastError = e.message;
      return false;
    } catch (_) {
      _lastError = 'Recovery could not be completed.';
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Compare derived addresses from a recovery phrase against registered metadata.
  Future<List<String>> findAddressMismatches({
    required AccountController account,
    required String recoveryPhrase,
  }) async {
    final token = await account.ensureAccessToken();
    if (token == null || token.isEmpty) return const [];
    final registered = await _api.listRegisteredAddresses(token);
    if (registered.isEmpty) return const [];

    final phrase = recoveryPhrase.trim();
    final derived = <String>{};
    for (final network in NetworkCatalog.receiveNetworks) {
      try {
        final address = HdDerivation.deriveAddress(mnemonic: phrase, network: network);
        if (address.isNotEmpty) derived.add(address.toLowerCase());
      } catch (_) {}
    }

    final mismatches = <String>[];
    for (final reg in registered) {
      if (!derived.contains(reg)) {
        mismatches.add(reg);
      }
    }
    return mismatches;
  }

  /// Emergency recovery: phrase → decrypt → rewrap under account password → upsert.
  Future<bool> performEmergencyRecovery({
    required AccountController account,
    required WalletController wallet,
    required String recoveryPhrase,
    required String accountPassword,
    bool forceDespiteMismatch = false,
  }) async {
    if (_busy) return false;
    final ownerId = account.profile?.id;
    if (ownerId == null || ownerId.isEmpty) return false;

    _busy = true;
    _lastError = null;
    notifyListeners();

    try {
      final mismatches = await findAddressMismatches(
        account: account,
        recoveryPhrase: recoveryPhrase,
      );
      if (mismatches.isNotEmpty && !forceDespiteMismatch) {
        _lastError =
            'Derived addresses do not match registered wallet metadata. Confirm before continuing.';
        _lastStatus = 'Address mismatch detected';
        return false;
      }

      final token = await account.ensureAccessToken();
      if (token == null || token.isEmpty) {
        throw const AuthException(AuthErrorKind.forbidden, 'Sign in is required.');
      }
      final envelope = await _vaultClient.getVault(accessToken: token);
      if (envelope == null || envelope.epoch == null) {
        throw const AuthException(AuthErrorKind.unknown, 'No secure backup found for this account.');
      }

      final payload = await rewrapVaultWithNewPassword(
        ownerUserId: ownerId,
        envelope: envelope,
        epoch: envelope.epoch!,
        recoveryPhrase: recoveryPhrase,
        newPassword: accountPassword,
      );

      final fingerprint = await _tokenStore.deviceFingerprint();
      await _vaultClient.upsertVault(
        accessToken: token,
        payload: payload,
        deviceId: _uuidOrNull(fingerprint),
      );

      final bundle = await decryptVaultBundle(
        ownerUserId: ownerId,
        envelope: envelope,
        epoch: envelope.epoch!,
        recoveryPhrase: recoveryPhrase,
      );
      await wallet.importEncryptedVaultBundle(bundle);

      _lastStatus = 'Wallet restored from emergency recovery.';
      return true;
    } on AuthException catch (e) {
      _lastError = e.message;
      return false;
    } catch (_) {
      _lastError = 'Emergency recovery failed. Check your recovery phrase and account password.';
      return false;
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}

String? _uuidOrNull(String? value) {
  if (value == null) return null;
  final v = value.trim();
  final uuidRe = RegExp(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
  );
  return uuidRe.hasMatch(v) ? v : null;
}
