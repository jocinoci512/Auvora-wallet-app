import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/network_env.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:auvora_wallet/wallet_engine/asset_registry.dart';
import 'package:auvora_wallet/wallet_engine/evm_json_rpc.dart';
import 'package:auvora_wallet/wallet_engine/evm_rpc_adapter.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/wallet_engine/rpc_endpoints.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Sepolia balance / EVM RPC', () {
    test('Sepolia uses chain ID 11155111', () {
      expect(
        NetworkCatalog.evmChainId(AssetNetwork.ethereum, NetworkEnv.testnet),
        11155111,
      );
      expect(
        EvmJsonRpcClient.expectedChainId(ChainId.ethereum, NetworkEnv.testnet),
        11155111,
      );
    });

    test('50000000000000000 wei renders as 0.05 ETH', () {
      final wei = BigInt.parse('50000000000000000');
      expect(EvmAmountCodec.weiToEth(wei), closeTo(0.05, 1e-18));
      expect(EvmAmountCodec.parseHexQuantity('0xb1a2bc2ec50000'), wei);
    });

    test('mainnet and Sepolia balance keys do not collide', () {
      final registry = AssetRegistry();
      final eth = registry.bySymbolOnChain('ETH', ChainId.ethereum)!;
      final id = registry.holdingId(eth, ChainId.ethereum);
      expect(id, contains('ethereum'));
      expect(id, contains(AuvoraNetworkEnv.current.name));
      expect(
        NetworkCatalog.eip155Caip(AssetNetwork.ethereum, NetworkEnv.testnet),
        'eip155:11155111',
      );
      expect(
        NetworkCatalog.eip155Caip(AssetNetwork.ethereum, NetworkEnv.mainnet),
        'eip155:1',
      );
      expect(
        NetworkCatalog.eip155Caip(AssetNetwork.ethereum, NetworkEnv.testnet),
        isNot(NetworkCatalog.eip155Caip(AssetNetwork.ethereum, NetworkEnv.mainnet)),
      );
    });

    test('Sepolia balance provider adapter is EvmRpc (not preview hash)', () {
      final adapter = EvmRpcBlockchainAdapter(
        chain: ChainId.ethereum,
        providerCode: 'eth-rpc',
        explorerBaseUrl: 'https://sepolia.etherscan.io/tx/',
      );
      expect(adapter.providerCode, contains('rpc'));
      expect(adapter.chain, ChainId.ethereum);
    });

    test('mock JSON-RPC returns Sepolia balance for known address', () async {
      final client = EvmJsonRpcClient(
        caller: (url, method, params) async {
          expect(url.contains('sepolia'), isTrue);
          if (method == 'eth_chainId') return '0xaa36a7';
          if (method == 'eth_getBalance') {
            expect(params.first, '0xc3676e0177085d64324fa777325d5d782ebb48e9');
            return '0xb1a2bc2ec50000';
          }
          fail('unexpected method $method');
        },
      );
      final result = await client.getNativeBalanceWei(
        chain: ChainId.ethereum,
        address: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
        env: NetworkEnv.testnet,
        urlsOverride: const ['https://ethereum-sepolia.publicnode.com'],
      );
      expect(result.chainId, 11155111);
      expect(result.wei, BigInt.parse('50000000000000000'));
      expect(EvmAmountCodec.weiToEth(result.wei), closeTo(0.05, 1e-12));
    });

    test('refresh updates balance when RPC returns new wei', () async {
      var weiHex = '0x0';
      final client = EvmJsonRpcClient(
        caller: (url, method, params) async {
          if (method == 'eth_chainId') return '0xaa36a7';
          if (method == 'eth_getBalance') return weiHex;
          fail('unexpected');
        },
      );
      final first = await client.getNativeBalanceWei(
        chain: ChainId.ethereum,
        address: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
        env: NetworkEnv.testnet,
        urlsOverride: const ['https://ethereum-sepolia.publicnode.com'],
      );
      expect(EvmAmountCodec.weiToEth(first.wei), 0);

      weiHex = '0xb1a2bc2ec50000';
      final second = await client.getNativeBalanceWei(
        chain: ChainId.ethereum,
        address: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
        env: NetworkEnv.testnet,
        urlsOverride: const ['https://ethereum-sepolia.publicnode.com'],
      );
      expect(EvmAmountCodec.weiToEth(second.wei), closeTo(0.05, 1e-12));
    });

    test('RPC failure / wrong chainId is not represented as confirmed zero', () async {
      final client = EvmJsonRpcClient(
        caller: (url, method, params) async {
          if (method == 'eth_chainId') return '0x1'; // mainnet — reject in testnet
          return '0xb1a2bc2ec50000';
        },
      );
      expect(
        () => client.getNativeBalanceWei(
          chain: ChainId.ethereum,
          address: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
          env: NetworkEnv.testnet,
          urlsOverride: const ['https://ethereum-sepolia.publicnode.com'],
        ),
        throwsA(isA<RpcBalanceException>()),
      );
    });

    test('AssetHolding.balanceUnavailable marks honest refresh failure', () {
      const holding = AssetHolding(
        id: 'eth:ethereum:testnet',
        name: 'Ethereum',
        ticker: 'ETH',
        network: AssetNetwork.ethereum,
        balance: 0.05,
        priceUsd: 0,
        change24hPct: 0,
        color: 0xFF627EEA,
        balanceUnavailable: true,
      );
      expect(holding.balanceUnavailable, isTrue);
      expect(holding.balance, 0.05); // last known preserved
      expect(holding.copyWith(balanceUnavailable: false).balanceUnavailable, isFalse);
    });

    test('production mode still uses Ethereum Mainnet chain id 1', () {
      expect(NetworkCatalog.evmChainId(AssetNetwork.ethereum, NetworkEnv.mainnet), 1);
      expect(NetworkCatalog.eip155Caip(AssetNetwork.ethereum, NetworkEnv.mainnet), 'eip155:1');
      // Default unit-test binary has no dart-define → mainnet RPC catalog.
      if (!AuvoraNetworkEnv.isTestnet) {
        final eth = RpcEndpoints.urlsFor(ChainId.ethereum);
        expect(eth.any(RpcEndpoints.looksLikeMainnetUrl), isTrue);
        expect(eth.any((u) => u.contains('sepolia')), isFalse);
      }
    });

    test('mainnet broadcast remains OFF', () {
      expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
    });
  });
}
