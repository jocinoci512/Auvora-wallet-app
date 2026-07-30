import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/reliability/cache_store.dart';
import 'package:auvora_wallet/reliability/retry.dart';
import 'package:auvora_wallet/wallet_engine/asset_registry.dart';
import 'package:auvora_wallet/wallet_engine/blockchain_adapter.dart';
import 'package:auvora_wallet/wallet_engine/key_store.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/wallet_engine/network_manager.dart';
import 'package:auvora_wallet/wallet_engine/price_service.dart';
import 'package:auvora_wallet/wallet_engine/sync_engine.dart';
import 'package:auvora_wallet/wallet_engine/wallet_engine.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final secureStore = <String, String>{};

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    secureStore.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async {
        switch (call.method) {
          case 'write':
            final key = call.arguments['key'] as String;
            final value = call.arguments['value'] as String?;
            if (value == null) {
              secureStore.remove(key);
            } else {
              secureStore[key] = value;
            }
            return null;
          case 'read':
            return secureStore[call.arguments['key'] as String];
          case 'delete':
            secureStore.remove(call.arguments['key'] as String);
            return null;
          default:
            return null;
        }
      },
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      null,
    );
  });

  test('withRetry caps attempts and eventually throws', () async {
    var calls = 0;
    await expectLater(
      () => withRetry(
        () async {
          calls += 1;
          throw StateError('boom');
        },
        maxAttempts: 3,
        initialDelay: Duration.zero,
        maxDelay: Duration.zero,
      ),
      throwsA(isA<StateError>()),
    );
    expect(calls, 3);
  });

  test('withRetry succeeds after transient failure', () async {
    var calls = 0;
    final value = await withRetry(
      () async {
        calls += 1;
        if (calls < 2) throw StateError('transient');
        return 42;
      },
      maxAttempts: 3,
      initialDelay: Duration.zero,
      maxDelay: Duration.zero,
    );
    expect(value, 42);
    expect(calls, 2);
  });

  test('CacheStore supports stale-while-revalidate reads', () async {
    final store = CacheStore();
    await store.write(
      ns: CacheStore.nsPortfolio,
      id: 'active',
      payload: {'total': 10},
      ttl: const Duration(milliseconds: 1),
    );
    await Future<void>.delayed(const Duration(milliseconds: 5));
    final freshDenied = await store.read<Map<String, Object?>>(
      ns: CacheStore.nsPortfolio,
      id: 'active',
      decode: (raw) => Map<String, Object?>.from(raw as Map),
      allowStale: false,
    );
    expect(freshDenied, isNull);
    final staleOk = await store.read<Map<String, Object?>>(
      ns: CacheStore.nsPortfolio,
      id: 'active',
      decode: (raw) => Map<String, Object?>.from(raw as Map),
      allowStale: true,
    );
    expect(staleOk?.stale, isTrue);
    expect(staleOk?.data['total'], 10);
  });

  test('SyncEngine paints cache then survives partial chain failure', () async {
    final layer = BlockchainLayer(
      adapters: [
        PreviewBlockchainAdapter(
          chain: ChainId.ethereum,
          providerCode: 'eth-sim',
          explorerBaseUrl: 'https://etherscan.io/tx/',
        ),
        _FailingAdapter(
          PreviewBlockchainAdapter(
            chain: ChainId.solana,
            providerCode: 'sol-sim',
            explorerBaseUrl: 'https://solscan.io/tx/',
          ),
        ),
      ],
    );
    final network = NetworkManager(blockchainLayer: layer)..forceOffline = false;

    final engine = WalletEngine(
      keyStore: SecureKeyStore(),
      blockchainLayer: layer,
    );
    await engine.importWallet(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    );

    final sync = SyncEngine(
      walletEngine: engine,
      blockchainLayer: layer,
      assetRegistry: AssetRegistry(),
      priceService: PriceService(),
      networkManager: network,
    );

    final live = await sync.loadPortfolio();
    expect(live.assets, isNotEmpty);
    expect(live.failedChains, contains('solana'));
    expect(live.syncDelayed, isTrue);
    expect(live.fromCache, isFalse);

    final cached = await sync.cachedPortfolio();
    expect(cached, isNotNull);
    expect(cached!.fromCache, isTrue);
    expect(cached.assets, isNotEmpty);

    network.forceOffline = true;
    final offline = await sync.loadPortfolio();
    expect(offline.fromCache, isTrue);
    expect(offline.offline, isTrue);
    expect(offline.assets, isNotEmpty);
  });
}

class _FailingAdapter implements BlockchainAdapter {
  _FailingAdapter(this._inner);

  final BlockchainAdapter _inner;

  @override
  ChainId get chain => _inner.chain;

  @override
  String get providerCode => _inner.providerCode;

  @override
  WalletAddressRecord deriveAddress({required String mnemonic, required int accountIndex}) =>
      _inner.deriveAddress(mnemonic: mnemonic, accountIndex: accountIndex);

  @override
  Future<double> getBalance({
    required WalletAddressRecord address,
    required String assetSymbol,
  }) async {
    throw StateError('simulated chain outage');
  }

  @override
  Future<List<PortfolioTx>> getHistory({required WalletAddressRecord address}) async {
    throw StateError('simulated chain outage');
  }

  @override
  Future<TransactionFeeEstimate> estimateFee({
    required WalletAddressRecord from,
    required String assetSymbol,
    required double amount,
  }) =>
      _inner.estimateFee(from: from, assetSymbol: assetSymbol, amount: amount);

  @override
  Future<TransactionDraft> buildTransaction({
    required WalletAddressRecord from,
    required String toAddress,
    required String assetSymbol,
    required double amount,
    String? memo,
  }) =>
      _inner.buildTransaction(
        from: from,
        toAddress: toAddress,
        assetSymbol: assetSymbol,
        amount: amount,
        memo: memo,
      );

  @override
  Future<String> signTransaction({
    required TransactionDraft draft,
    required String mnemonic,
  }) =>
      _inner.signTransaction(draft: draft, mnemonic: mnemonic);

  @override
  Future<TransactionSubmissionResult> broadcast({
    required TransactionDraft draft,
    required String signedPayload,
  }) =>
      _inner.broadcast(draft: draft, signedPayload: signedPayload);

  @override
  Future<EndpointHealth> ping() => _inner.ping();
}
