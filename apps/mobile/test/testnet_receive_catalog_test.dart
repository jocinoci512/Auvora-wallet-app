import 'package:auvora_wallet/connections/wc_chain_catalog.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/network_env.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('NetworkCatalog · testnet mode', () {
    const env = NetworkEnv.testnet;

    test('receive catalog includes all QA test networks', () {
      expect(NetworkCatalog.receiveNetworks, contains(AssetNetwork.ethereum));
      expect(NetworkCatalog.receiveNetworks, contains(AssetNetwork.bnbSmartChain));
      expect(NetworkCatalog.receiveNetworks, contains(AssetNetwork.polygon));
      expect(NetworkCatalog.receiveNetworks, contains(AssetNetwork.solana));
      expect(NetworkCatalog.receiveNetworks, contains(AssetNetwork.bitcoin));
      expect(NetworkCatalog.receiveNetworks, contains(AssetNetwork.tron));
      expect(NetworkCatalog.receiveNetworks.length, 6);
    });

    test('Sepolia appears in Receive labels (not mainnet)', () {
      final label = NetworkCatalog.displayName(AssetNetwork.ethereum, env);
      expect(label, contains('Sepolia'));
      expect(label.toLowerCase(), isNot(contains('mainnet')));
      expect(NetworkCatalog.laneName(AssetNetwork.ethereum, env), 'Sepolia');
    });

    test('Sepolia chain ID is 11155111', () {
      expect(NetworkCatalog.evmChainId(AssetNetwork.ethereum, env), 11155111);
      expect(NetworkCatalog.eip155Caip(AssetNetwork.ethereum, env), 'eip155:11155111');
    });

    test('BSC Testnet appears', () {
      expect(NetworkCatalog.displayName(AssetNetwork.bnbSmartChain, env), contains('Testnet'));
      expect(NetworkCatalog.evmChainId(AssetNetwork.bnbSmartChain, env), 97);
      expect(NetworkCatalog.laneName(AssetNetwork.bnbSmartChain, env), 'BSC Testnet');
    });

    test('Polygon Amoy appears', () {
      expect(NetworkCatalog.displayName(AssetNetwork.polygon, env), contains('Amoy'));
      expect(NetworkCatalog.evmChainId(AssetNetwork.polygon, env), 80002);
      expect(NetworkCatalog.laneName(AssetNetwork.polygon, env), 'Amoy');
    });

    test('Solana Devnet appears', () {
      expect(NetworkCatalog.displayName(AssetNetwork.solana, env), contains('Devnet'));
      expect(NetworkCatalog.laneName(AssetNetwork.solana, env), 'Devnet');
    });

    test('Bitcoin Testnet3 appears', () {
      expect(NetworkCatalog.displayName(AssetNetwork.bitcoin, env), contains('Testnet3'));
      expect(NetworkCatalog.laneName(AssetNetwork.bitcoin, env), 'Testnet3');
    });

    test('Tron Nile appears', () {
      expect(NetworkCatalog.displayName(AssetNetwork.tron, env), contains('Nile'));
      expect(NetworkCatalog.laneName(AssetNetwork.tron, env), 'Nile');
    });

    test('mainnet EVM IDs remain blocked as production chain ids', () {
      expect(NetworkCatalog.isMainnetEvmChainId(1), isTrue);
      expect(NetworkCatalog.isMainnetEvmChainId(56), isTrue);
      expect(NetworkCatalog.isMainnetEvmChainId(137), isTrue);
      expect(NetworkCatalog.isMainnetEvmChainId(11155111), isFalse);
      expect(NetworkCatalog.isMainnetEvmChainId(97), isFalse);
      expect(NetworkCatalog.isMainnetEvmChainId(80002), isFalse);
    });
  });

  group('NetworkCatalog · production / mainnet mode', () {
    const env = NetworkEnv.mainnet;

    test('production catalog uses production labels', () {
      expect(NetworkCatalog.displayName(AssetNetwork.ethereum, env), 'Ethereum');
      expect(NetworkCatalog.displayName(AssetNetwork.bnbSmartChain, env), 'BNB Smart Chain');
      expect(NetworkCatalog.displayName(AssetNetwork.polygon, env), 'Polygon');
      expect(NetworkCatalog.displayName(AssetNetwork.solana, env), 'Solana');
      expect(NetworkCatalog.displayName(AssetNetwork.bitcoin, env), 'Bitcoin');
      expect(NetworkCatalog.displayName(AssetNetwork.tron, env), 'Tron');
    });

    test('production EVM chain IDs', () {
      expect(NetworkCatalog.evmChainId(AssetNetwork.ethereum, env), 1);
      expect(NetworkCatalog.evmChainId(AssetNetwork.bnbSmartChain, env), 56);
      expect(NetworkCatalog.evmChainId(AssetNetwork.polygon, env), 137);
      expect(NetworkCatalog.eip155Caip(AssetNetwork.ethereum, env), 'eip155:1');
    });

    test('production labels never say Sepolia', () {
      for (final n in NetworkCatalog.receiveNetworks) {
        expect(NetworkCatalog.displayName(n, env), isNot(contains('Sepolia')));
        expect(NetworkCatalog.displayName(n, env), isNot(contains('Amoy')));
        expect(NetworkCatalog.displayName(n, env), isNot(contains('Devnet')));
        expect(NetworkCatalog.displayName(n, env), isNot(contains('Nile')));
        expect(NetworkCatalog.displayName(n, env), isNot(contains('Testnet3')));
      }
    });
  });

  group('release gates', () {
    test('mainnet broadcast remains OFF', () {
      expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
    });

    test('default (no dart-define) build is mainnet runtime', () {
      expect(AuvoraNetworkEnv.isTestnet, isFalse);
      expect(AuvoraNetworkEnv.isMainnet, isTrue);
      expect(ReleaseConfig.canBroadcastTestnet, isFalse);
    });

    test('WC default catalog is production mainnet CAIPs', () {
      expect(WcChainCatalog.supportedEip155Chains, contains('eip155:1'));
      expect(WcChainCatalog.supportedEip155Chains, isNot(contains('eip155:11155111')));
    });
  });
}
