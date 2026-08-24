import 'package:auvora_wallet/release/release_config.dart';
import 'package:auvora_wallet/wallet_engine/rpc_endpoints.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/connections/wc_chain_catalog.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/transfer/address_validation.dart';
import 'package:flutter_test/flutter_test.dart';

/// Mainnet isolation / testnet catalog guards (default build = mainnet).
void main() {
  test('mainnet live broadcast remains OFF', () {
    expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
  });

  test('default network is mainnet (no dart-define)', () {
    expect(ReleaseConfig.networkIsTestnet, isFalse);
    expect(ReleaseConfig.canBroadcastTestnet, isFalse);
  });

  test('WC advertises mainnet CAIPs by default', () {
    expect(WcChainCatalog.supportedEip155Chains, contains('eip155:1'));
    expect(WcChainCatalog.supportedEip155Chains, contains('eip155:56'));
    expect(WcChainCatalog.supportedEip155Chains, contains('eip155:137'));
    expect(WcChainCatalog.supportedEip155Chains, isNot(contains('eip155:11155111')));
  });

  test('RPC defaults do not mix testnet hosts on mainnet build', () {
    final eth = RpcEndpoints.urlsFor(ChainId.ethereum);
    expect(eth.any(RpcEndpoints.looksLikeMainnetUrl), isTrue);
    expect(eth.any((u) => u.contains('sepolia')), isFalse);
  });

  test('Bitcoin mainnet rejects tb1 destinations', () {
    final v = AddressValidation.validate(
      'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      expected: AssetNetwork.bitcoin,
    );
    expect(v.ok, isFalse);
    expect(v.issue, AddressIssue.wrongNetwork);
  });

  test('Bitcoin mainnet accepts bc1', () {
    final v = AddressValidation.validate(
      'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
      expected: AssetNetwork.bitcoin,
    );
    expect(v.ok, isTrue);
  });

  test('mainnet EVM chain id catalog excludes testnets from product defaults', () {
    expect(WcChainCatalog.isMainnetCaip('eip155:1'), isTrue);
    expect(WcChainCatalog.isMainnetCaip('eip155:11155111'), isFalse);
  });
}
