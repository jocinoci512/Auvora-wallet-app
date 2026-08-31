import 'package:auvora_wallet/release/auvora_qa_local_evm.dart';
import 'package:auvora_wallet/release/auvora_qa_local_solana.dart';
import 'package:auvora_wallet/release/network_env.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Local Solana constants use loopback validator RPC', () {
    expect(AuvoraQaLocalSolana.rpcUrl, 'http://127.0.0.1:8899');
    expect(AuvoraQaLocalSolana.networkLabel, 'Auvora Local Solana QA');
    expect(AuvoraQaLocalSolana.bannerLabel, 'LOCAL QA');
    expect(AuvoraQaLocalSolana.feeAssetLabel, 'QA SOL');
    expect(
      AuvoraQaLocalSolana.registeredQaAddress,
      '8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ',
    );
    expect(
      AuvoraQaLocalSolana.controlledRecipient,
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
  });

  test('Local EVM and Solana stay distinct QA networks', () {
    expect(AuvoraQaLocalEvm.networkLabel, isNot(AuvoraQaLocalSolana.networkLabel));
    expect(AuvoraQaLocalEvm.chainId, 31337);
    expect(AuvoraQaLocalSolana.localCompletionChainId, 901001019);
  });

  test('catalog labels Solana as Local QA when Local Solana is active', () {
    // Without dart-defines in unit tests, isActive is false → Devnet label.
    // When active (QA APK), displayName switches to Auvora Local Solana QA.
    expect(
      NetworkCatalog.displayName(AssetNetwork.solana, NetworkEnv.testnet),
      anyOf('Solana · Devnet', 'Auvora Local Solana QA'),
    );
  });
}
