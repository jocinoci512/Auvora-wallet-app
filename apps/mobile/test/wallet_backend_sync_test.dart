import 'dart:convert';

import 'package:auvora_wallet/account/auth_api_client.dart';
import 'package:auvora_wallet/account/wallet_backend_sync.dart';
import 'package:auvora_wallet/account/wallet_registration_client.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/network_env.dart';
import 'package:auvora_wallet/state/wallet_controller.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ensurePublicWalletsRegistered', () {
    test('registers restored public accounts without secrets', () async {
      final bodies = <Map<String, dynamic>>[];
      final client = WalletRegistrationClient(
        baseUrl: 'https://api.auvorawallet.com',
        httpClient: MockClient((request) async {
          bodies.add(jsonDecode(request.body) as Map<String, dynamic>);
          return http.Response(
            jsonEncode({
              'data': {'id': 'w-${bodies.length}', 'metadata': {'networkEnv': 'testnet'}},
            }),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      final sync = WalletBackendSync(client: client);
      final evm = '0x${'a' * 40}';
      final count = await sync.registerAccounts(
        accessToken: 'test-token',
        accounts: [
          (network: AssetNetwork.ethereum, address: evm),
          (network: AssetNetwork.bnbSmartChain, address: evm),
          (network: AssetNetwork.polygon, address: evm),
          (network: AssetNetwork.bitcoin, address: 'tb1qtestrestore00000000000000000000000000'),
          (network: AssetNetwork.solana, address: '4Nd1m3C6XzY9pQ2RestoredSolanaAddr1111111'),
          (network: AssetNetwork.tron, address: 'TXYZrestoredTronAddress111111111111'),
        ],
      );
      expect(count, 6);
      expect(bodies.length, 6);
      expect(bodies.map((b) => b['assetCode']), ['ETH', 'BNB', 'POL', 'BTC', 'SOL', 'TRX']);
      expect(bodies[0]['address'], evm);
      expect(bodies[1]['address'], evm);
      expect(bodies[2]['address'], evm);
      for (final body in bodies) {
        final encoded = jsonEncode(body).toLowerCase();
        expect(encoded, isNot(contains('mnemonic')));
        expect(encoded, isNot(contains('private')));
        expect(encoded, isNot(contains('seed')));
        expect(body['networkEnv'], AuvoraNetworkEnv.current.name);
        expect(body['selfCustody'], isTrue);
      }
    });

    test('repeated registration of the same accounts is idempotent on the client', () async {
      var posts = 0;
      final client = WalletRegistrationClient(
        baseUrl: 'https://api.auvorawallet.com',
        httpClient: MockClient((request) async {
          posts += 1;
          return http.Response(
            jsonEncode({
              'data': {'id': 'w1', 'status': posts == 1 ? 'created' : 'exists'},
            }),
            posts == 1 ? 200 : 409,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      final sync = WalletBackendSync(client: client);
      final accounts = [
        (network: AssetNetwork.ethereum, address: '0x${'b' * 40}'),
      ];
      await sync.registerAccounts(accessToken: 't', accounts: accounts);
      await sync.registerAccounts(accessToken: 't', accounts: accounts);
      expect(posts, 2);
      expect(sync.registeredCount, 1);
    });

    test('backend failure does not throw away remaining chains and reports a friendly error', () async {
      var calls = 0;
      final client = WalletRegistrationClient(
        baseUrl: 'https://api.auvorawallet.com',
        httpClient: MockClient((request) async {
          calls += 1;
          if (calls == 1) {
            return http.Response('{}', 503, headers: {'content-type': 'application/json'});
          }
          return http.Response(
            jsonEncode({'data': {'id': 'w2'}}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      final sync = WalletBackendSync(client: client);
      await expectLater(
        sync.registerAccounts(
          accessToken: 't',
          accounts: [
            (network: AssetNetwork.ethereum, address: '0x${'c' * 40}'),
            (network: AssetNetwork.bitcoin, address: 'tb1qaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
          ],
        ),
        throwsA(isA<AuthException>()),
      );
      expect(sync.registeredCount, 1);
    });

    test('retry succeeds when the backend returns', () async {
      var calls = 0;
      final client = WalletRegistrationClient(
        baseUrl: 'https://api.auvorawallet.com',
        httpClient: MockClient((request) async {
          calls += 1;
          if (calls == 1) {
            return http.Response('{}', 500, headers: {'content-type': 'application/json'});
          }
          return http.Response(
            jsonEncode({'data': {'id': 'w-ok'}}),
            200,
            headers: {'content-type': 'application/json'},
          );
        }),
      );
      final sync = WalletBackendSync(client: client);
      final accounts = [
        (network: AssetNetwork.ethereum, address: '0x${'d' * 40}'),
      ];
      await expectLater(
        sync.registerAccounts(accessToken: 't', accounts: accounts),
        throwsA(isA<AuthException>()),
      );
      final ok = await sync.registerAccounts(accessToken: 't', accounts: accounts);
      expect(ok, 1);
    });

    test('publicAccountsFrom uses restored vault addresses without unlock or ETH fallback', () {
      final wallet = WalletController();
      wallet.unlocked = false;
      wallet.address = '0x${'a' * 40}';
      wallet.wallet = WalletVaultRecord(
        walletId: 'restored-wallet',
        createdAt: DateTime.utc(2026, 1, 1),
        supportedChains: ChainId.values,
        accounts: [
          WalletAccountRecord(
            id: 'acct-0',
            name: 'Primary',
            index: 0,
            addresses: [
              WalletAddressRecord(
                chain: ChainId.ethereum,
                address: '0x${'a' * 40}',
                derivationPath: "m/44'/60'/0'/0/0",
              ),
              WalletAddressRecord(
                chain: ChainId.bnbSmartChain,
                address: '0x${'a' * 40}',
                derivationPath: "m/44'/60'/0'/0/0",
              ),
              WalletAddressRecord(
                chain: ChainId.polygon,
                address: '0x${'a' * 40}',
                derivationPath: "m/44'/60'/0'/0/0",
              ),
              WalletAddressRecord(
                chain: ChainId.bitcoin,
                address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
                derivationPath: "m/84'/1'/0'/0/0",
              ),
              WalletAddressRecord(
                chain: ChainId.solana,
                address: '4Nd1m3C6XzY9pQ2RestoredSolanaAddr1111111',
                derivationPath: "m/44'/501'/0'/0'",
              ),
              WalletAddressRecord(
                chain: ChainId.tron,
                address: 'TXYZrestoredTronAddress1111111111',
                derivationPath: "m/44'/195'/0'/0/0",
              ),
            ],
          ),
        ],
      );

      final accounts = WalletBackendSync.publicAccountsFrom(wallet);
      expect(wallet.unlocked, isFalse);
      expect(accounts.length, 6);
      expect(
        accounts.firstWhere((a) => a.network == AssetNetwork.ethereum).address,
        '0x${'a' * 40}',
      );
      expect(
        accounts.firstWhere((a) => a.network == AssetNetwork.bnbSmartChain).address,
        '0x${'a' * 40}',
      );
      expect(
        accounts.firstWhere((a) => a.network == AssetNetwork.polygon).address,
        '0x${'a' * 40}',
      );
      expect(
        accounts.firstWhere((a) => a.network == AssetNetwork.bitcoin).address,
        startsWith('tb1'),
      );
      expect(
        accounts.firstWhere((a) => a.network == AssetNetwork.solana).address,
        isNot(startsWith('0x')),
      );
      expect(
        accounts.firstWhere((a) => a.network == AssetNetwork.tron).address,
        startsWith('T'),
      );
    });

    test('publicAccountsFrom does not register the ETH address as bitcoin when BTC is missing', () {
      final wallet = WalletController();
      wallet.address = '0x${'a' * 40}';
      wallet.wallet = WalletVaultRecord(
        walletId: 'evm-only',
        createdAt: DateTime.utc(2026, 1, 1),
        supportedChains: const [ChainId.ethereum],
        accounts: [
          WalletAccountRecord(
            id: 'acct-0',
            name: 'Primary',
            index: 0,
            addresses: [
              WalletAddressRecord(
                chain: ChainId.ethereum,
                address: '0x${'a' * 40}',
                derivationPath: "m/44'/60'/0'/0/0",
              ),
            ],
          ),
        ],
      );

      final accounts = WalletBackendSync.publicAccountsFrom(wallet);
      expect(accounts.length, 1);
      expect(accounts.single.network, AssetNetwork.ethereum);
      expect(accounts.single.address, '0x${'a' * 40}');
    });
  });
}
