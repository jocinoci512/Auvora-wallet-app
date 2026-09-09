import 'dart:async';

import 'package:flutter/foundation.dart';

import '../portfolio/models.dart';
import '../release/network_env.dart';
import '../reliability/startup_timing.dart';
import '../state/wallet_controller.dart';
import '../wallet_engine/models.dart';
import 'account_controller.dart';
import 'auth_api_client.dart';
import 'wallet_registration_client.dart';

/// Canonical public-wallet registration after create / restore / unlock / sign-in.
///
/// Never uploads secrets. Failures do not wipe or regenerate the local vault.
/// Listens to account + wallet controllers so registration still runs when the
/// Flutter view is paused (post-frame callbacks do not).
class WalletBackendSync extends ChangeNotifier {
  WalletBackendSync({
    WalletRegistrationClient? client,
  }) : _client = client ?? WalletRegistrationClient();

  final WalletRegistrationClient _client;

  AccountController? _account;
  WalletController? _wallet;
  bool _busy = false;
  String? _lastError;
  DateTime? _lastSuccessAt;
  int _registeredCount = 0;
  int _retryAttempt = 0;
  Timer? _retryTimer;
  String? _lastKey;

  bool get busy => _busy;
  String? get lastError => _lastError;
  DateTime? get lastSuccessAt => _lastSuccessAt;
  int get registeredCount => _registeredCount;
  bool get isConfigured => _client.isConfigured;
  bool get needsSyncWarning => _lastError != null && _lastError!.isNotEmpty;

  /// Wire account + wallet so restore/sign-in notify registration without a frame.
  void attach({
    required AccountController account,
    required WalletController wallet,
  }) {
    if (!identical(_account, account)) {
      _account?.removeListener(_onControllersChanged);
      _account = account;
      _account!.addListener(_onControllersChanged);
    }
    if (!identical(_wallet, wallet)) {
      _wallet?.removeListener(_onControllersChanged);
      _wallet = wallet;
      _wallet!.addListener(_onControllersChanged);
    }
    _onControllersChanged();
  }

  void _onControllersChanged() {
    final account = _account;
    final wallet = _wallet;
    if (account == null || wallet == null) return;
    // Microtask: never wait for a vsync frame (paused Activity would stall).
    // ignore: discarded_futures
    Future<void>(() async {
      await ensurePublicWalletsRegistered(account: account, wallet: wallet);
    });
  }

  /// Safe public accounts already present on the restored wallet (no unlock required).
  /// Does not fall back to the Ethereum address for other chains.
  static List<({AssetNetwork network, String address})> publicAccountsFrom(
    WalletController wallet,
  ) {
    final record = wallet.wallet;
    if (record == null) {
      final eth = wallet.address;
      if (eth == null || eth.isEmpty) return const [];
      return [
        (network: AssetNetwork.ethereum, address: eth),
        (network: AssetNetwork.bnbSmartChain, address: eth),
        (network: AssetNetwork.polygon, address: eth),
      ];
    }
    final out = <({AssetNetwork network, String address})>[];
    for (final network in NetworkCatalog.receiveNetworks) {
      final address = record.primaryAddress(chain: ChainIdMeta.fromAssetNetwork(network));
      if (address == null || address.isEmpty) continue;
      out.add((network: network, address: address));
    }
    return out;
  }

  Future<void> ensurePublicWalletsRegistered({
    required AccountController account,
    required WalletController wallet,
  }) async {
    if (!account.isConfigured || !account.isSignedIn) return;
    final accounts = publicAccountsFrom(wallet);
    if (accounts.isEmpty) return;
    if (_busy) return;
    String? eth;
    for (final item in accounts) {
      if (item.network == AssetNetwork.ethereum) {
        eth = item.address;
        break;
      }
    }
    final key = '${account.profile?.id}|${eth ?? ''}|${accounts.length}';
    if (key == _lastKey && _lastError == null) return;

    _busy = true;
    notifyListeners();
    StartupTiming.mark('walletPublicRegStart');

    try {
      // Refresh first — stale access tokens were causing a false "sign in again /
      // link wallet" Home banner while the local wallet was already unlocked.
      final token = await account.ensureAccessToken();
      if (token == null || token.isEmpty) {
        // Session expired: keep the local wallet UI clean — do not imply linking.
        _lastError = null;
        StartupTiming.mark('walletPublicRegSkipAuth');
        return;
      }
      await registerAccounts(accessToken: token, accounts: accounts);
      _lastSuccessAt = DateTime.now();
      _lastError = null;
      _lastKey = key;
      _retryAttempt = 0;
      _retryTimer?.cancel();
      StartupTiming.mark('walletPublicRegDone');
    } on AuthException catch (e) {
      if (e.kind == AuthErrorKind.forbidden ||
          e.kind == AuthErrorKind.invalidCredentials ||
          e.kind == AuthErrorKind.emailNotVerified) {
        // Auth problem is not a wallet-link problem. Clear banner; session UX owns it.
        _lastError = null;
        StartupTiming.mark('walletPublicRegFailAuth');
        return;
      }
      _lastError = _friendlySyncMessage(e);
      StartupTiming.mark('walletPublicRegFail');
      _scheduleRetry(account: account, wallet: wallet);
    } catch (_) {
      _lastError = 'Account details will update when the connection is stable.';
      StartupTiming.mark('walletPublicRegFail');
      _scheduleRetry(account: account, wallet: wallet);
    } finally {
      _busy = false;
      notifyListeners();
    }
  }

  /// Test/entry-point used by create, restore, sign-in, and vault unlock.
  Future<int> registerAccounts({
    required String accessToken,
    required List<({AssetNetwork network, String address})> accounts,
  }) async {
    var ok = 0;
    AuthException? lastFailure;
    for (final account in accounts) {
      try {
        await _client.importPublicAddress(
          accessToken: accessToken,
          network: account.network,
          address: account.address,
        );
        ok += 1;
      } on AuthException catch (e) {
        lastFailure = e;
      }
    }
    _registeredCount = ok;
    if (ok == 0 && lastFailure != null) {
      throw lastFailure;
    }
    if (ok < accounts.length) {
      throw const AuthException(
        AuthErrorKind.server,
        'Some wallet metadata could not sync yet.',
      );
    }
    return ok;
  }

  void _scheduleRetry({
    required AccountController account,
    required WalletController wallet,
  }) {
    if (_retryAttempt >= 3) return;
    _retryTimer?.cancel();
    final delay = Duration(seconds: 4 * (1 << _retryAttempt));
    _retryAttempt += 1;
    _retryTimer = Timer(delay, () {
      // ignore: discarded_futures
      ensurePublicWalletsRegistered(account: account, wallet: wallet);
    });
  }

  static String _friendlySyncMessage(AuthException e) {
    switch (e.kind) {
      case AuthErrorKind.network:
      case AuthErrorKind.timeout:
      case AuthErrorKind.server:
        return 'Account details will update when the connection is stable.';
      default:
        return 'Account details will update when the connection is stable.';
    }
  }

  @override
  void dispose() {
    _retryTimer?.cancel();
    _account?.removeListener(_onControllersChanged);
    _wallet?.removeListener(_onControllersChanged);
    super.dispose();
  }
}
