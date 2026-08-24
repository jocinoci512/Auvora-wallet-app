import 'package:flutter/foundation.dart';

import '../release/network_env.dart';
import '../state/wallet_controller.dart';
import 'account_controller.dart';
import 'auth_api_client.dart';
import 'wallet_registration_client.dart';

/// Pushes public wallet addresses to the backend after sign-in / unlock.
///
/// Never uploads secrets. Failures are recorded for UI honesty but do not wipe
/// the local vault.
class WalletBackendSync extends ChangeNotifier {
  WalletBackendSync({
    WalletRegistrationClient? client,
  }) : _client = client ?? WalletRegistrationClient();

  final WalletRegistrationClient _client;

  bool _busy = false;
  String? _lastError;
  DateTime? _lastSuccessAt;
  int _registeredCount = 0;

  bool get busy => _busy;
  String? get lastError => _lastError;
  DateTime? get lastSuccessAt => _lastSuccessAt;
  int get registeredCount => _registeredCount;
  bool get isConfigured => _client.isConfigured;

  Future<void> syncIfPossible({
    required AccountController account,
    required WalletController wallet,
  }) async {
    if (!account.isConfigured || !account.isSignedIn) return;
    if (!wallet.unlocked || wallet.wallet == null) return;
    if (_busy) return;

    _busy = true;
    _lastError = null;
    notifyListeners();

    try {
      final token = await account.readAccessToken();
      if (token == null || token.isEmpty) {
        throw const AuthException(
          AuthErrorKind.forbidden,
          'Sign in is required before wallet metadata can sync.',
        );
      }

      var ok = 0;
      for (final network in NetworkCatalog.receiveNetworks) {
        final address = wallet.addressFor(network);
        if (address == null || address.isEmpty) continue;
        await _client.importPublicAddress(
          accessToken: token,
          network: network,
          address: address,
        );
        ok += 1;
      }
      _registeredCount = ok;
      _lastSuccessAt = DateTime.now();
      _lastError = null;
    } on AuthException catch (e) {
      _lastError = e.message;
    } catch (_) {
      _lastError = 'Wallet metadata sync failed. Try again after sign-in.';
    } finally {
      _busy = false;
      notifyListeners();
    }
  }
}
