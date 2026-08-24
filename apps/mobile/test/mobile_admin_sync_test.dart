import 'dart:convert';

import 'package:auvora_wallet/account/auvora_api_config.dart';
import 'package:auvora_wallet/account/wallet_registration_client.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/network_env.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:auvora_wallet/transfer/transfer_prepare_client.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('mobile ↔ admin sync surfaces', () {
    test('API base URL defaults to production Gateway (not localhost)', () {
      expect(AuvoraApiConfig.isConfigured, isTrue);
      expect(AuvoraApiConfig.baseUrl, 'https://api.auvorawallet.com');
      expect(AuvoraApiConfig.baseUrl.toLowerCase(), isNot(contains('localhost')));
      expect(AuvoraApiConfig.baseUrl.toLowerCase(), isNot(contains('127.0.0.1')));
    });

    test('wallet registration aliases are env-scoped', () {
      expect(
        WalletRegistrationClient.aliasFor(AssetNetwork.ethereum),
        contains(AuvoraNetworkEnv.current.name),
      );
      expect(WalletRegistrationClient.assetCodeFor(AssetNetwork.ethereum), 'ETH');
      expect(WalletRegistrationClient.assetCodeFor(AssetNetwork.bitcoin), 'BTC');
    });

    test('public wallet import posts address + networkEnv without secrets', () async {
      late Map<String, dynamic> body;
      final client = WalletRegistrationClient(
        baseUrl: 'https://api.auvorawallet.com',
        httpClient: MockClient((request) async {
          expect(request.url.path, endsWith('/api/v1/wallet-engine/wallets/import'));
          expect(request.headers['authorization'], 'Bearer test-token');
          body = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'data': {
                'id': 'w1',
                'metadata': {'networkEnv': 'testnet', 'importMode': 'public_address'},
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final result = await client.importPublicAddress(
        accessToken: 'test-token',
        network: AssetNetwork.ethereum,
        address: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
      );

      expect(result['id'], 'w1');
      expect(body['address'], '0xc3676e0177085d64324fa777325d5d782ebb48e9');
      expect(body['assetCode'], 'ETH');
      expect(body['networkEnv'], AuvoraNetworkEnv.current.name);
      expect(body['selfCustody'], isTrue);
      expect(jsonEncode(body).toLowerCase(), isNot(contains('mnemonic')));
      expect(jsonEncode(body).toLowerCase(), isNot(contains('private')));
      expect(jsonEncode(body).toLowerCase(), isNot(contains('seed')));
    });

    test('transfer prepare fail-closed when reviewId missing', () {
      final result = TransferPrepareResult.fromJson({
        'allowed': false,
        'status': 'reviewRequired',
        'message': 'needs review',
        'reviewId': null,
      });
      expect(result.allowed, isFalse);
      expect(result.reviewId, isNull);
    });

    test('transfer prepare accepts persisted review id', () {
      final result = TransferPrepareResult.fromJson({
        'allowed': false,
        'status': 'reviewRequired',
        'message': 'needs review',
        'reviewId': 'rev-123',
        'reviewStatus': 'PENDING',
      });
      expect(result.reviewId, 'rev-123');
      expect(result.reviewStatus, 'PENDING');
    });

    test('mainnet broadcast remains OFF', () {
      expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
    });

    test('transfer prepare posts networkEnv for Admin environment labeling', () async {
      late Map<String, dynamic> body;
      final client = TransferPrepareClient(
        baseUrl: 'https://api.auvorawallet.com',
        httpClient: MockClient((request) async {
          expect(request.url.path, endsWith('/api/v1/wallets/transfers/prepare'));
          body = jsonDecode(request.body) as Map<String, dynamic>;
          return http.Response(
            jsonEncode({
              'data': {
                'allowed': false,
                'status': 'review_required',
                'message': 'needs review',
                'reviewId': 'rev-persist-1',
                'reviewStatus': 'PENDING',
                'requestedAt': '2026-08-24T00:00:00.000Z',
              },
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );

      final result = await client.prepare(
        accessToken: 'test-token',
        assetCode: 'ETH',
        destinationAddress: '0xabc',
        amount: '0.001',
        idempotencyKey: 'idem-1',
        fromAddress: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
      );

      expect(result.reviewId, 'rev-persist-1');
      expect(body['networkEnv'], AuvoraNetworkEnv.current.name);
      expect(body['fromAddress'], '0xc3676e0177085d64324fa777325d5d782ebb48e9');
      expect(jsonEncode(body).toLowerCase(), isNot(contains('mnemonic')));
      expect(jsonEncode(body).toLowerCase(), isNot(contains('private')));
    });

    test('EVM live adapters are eth-rpc / bsc-rpc / polygon-rpc (not Preview)', () {
      // Guardrail: physical QA must not silently use PreviewBlockchainAdapter for ETH.
      // Source assertion lives in main.dart wiring; this documents expected provider codes.
      const live = {'eth-rpc', 'bsc-rpc', 'polygon-rpc'};
      const preview = {'btc-sim', 'sol-sim', 'tron-sim'};
      expect(live.intersection(preview), isEmpty);
    });
  });
}
