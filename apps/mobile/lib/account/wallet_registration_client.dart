import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../account/auvora_api_config.dart';
import '../account/auth_api_client.dart';
import '../portfolio/models.dart';
import '../release/network_env.dart';

/// Registers **public** on-device wallet addresses with the backend so Admin can
/// see metadata. Never sends mnemonic / seed / private key.
class WalletRegistrationClient {
  WalletRegistrationClient({
    http.Client? httpClient,
    String? baseUrl,
    this.timeout = const Duration(seconds: 20),
  })  : _http = httpClient ?? http.Client(),
        _baseUrl = (baseUrl ?? AuvoraApiConfig.baseUrl).trim();

  final http.Client _http;
  final String _baseUrl;
  final Duration timeout;

  bool get isConfigured => _baseUrl.isNotEmpty;

  static String assetCodeFor(AssetNetwork network) => switch (network) {
        AssetNetwork.ethereum => 'ETH',
        AssetNetwork.bitcoin => 'BTC',
        AssetNetwork.solana => 'SOL',
        AssetNetwork.bnbSmartChain => 'BNB',
        AssetNetwork.tron => 'TRX',
        AssetNetwork.polygon => 'POL',
      };

  static String aliasFor(AssetNetwork network) =>
      'auvora-mobile-${AuvoraNetworkEnv.current.name}-${assetCodeFor(network).toLowerCase()}';

  /// Idempotent public-address import for one chain.
  Future<Map<String, dynamic>> importPublicAddress({
    required String accessToken,
    required AssetNetwork network,
    required String address,
    String? label,
  }) async {
    if (!isConfigured) {
      throw const AuthException(
        AuthErrorKind.notConfigured,
        'Account backend is not configured for this build.',
      );
    }
    final trimmed = address.trim();
    if (trimmed.isEmpty) {
      throw const AuthException(AuthErrorKind.unknown, 'Missing public address.');
    }
    try {
      final res = await _http
          .post(
            Uri.parse(
              '${_baseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1/wallet-engine/wallets/import',
            ),
            headers: {
              'content-type': 'application/json',
              'accept': 'application/json',
              'authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({
              'assetCode': assetCodeFor(network),
              'address': trimmed,
              'alias': aliasFor(network),
              'label': label ?? AuvoraNetworkEnv.displayName(network),
              'networkEnv': AuvoraNetworkEnv.current.name,
              'clientPlatform': AuvoraApiConfig.platform,
              'selfCustody': true,
            }),
          )
          .timeout(timeout);

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
      if (res.statusCode == 401 || res.statusCode == 403) {
        throw const AuthException(
          AuthErrorKind.forbidden,
          'Could not register wallet metadata. Sign in and try again.',
        );
      }
      if (res.statusCode == 409) {
        // Already registered — treat as success for sync.
        return {'status': 'exists', 'address': trimmed};
      }
      throw const AuthException(
        AuthErrorKind.server,
        'Wallet registration could not be completed.',
      );
    } on TimeoutException {
      throw const AuthException(
        AuthErrorKind.timeout,
        'Wallet registration timed out.',
      );
    } on AuthException {
      rethrow;
    } catch (_) {
      throw const AuthException(
        AuthErrorKind.network,
        'No internet connection. Wallet registration skipped.',
      );
    }
  }
}
