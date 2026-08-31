import 'package:auvora_wallet/connections/evm_local_signer.dart';
import 'package:auvora_wallet/crypto/wallet_crypto.dart';
import 'package:auvora_wallet/engine/quote_engine.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/state/wallet_controller.dart';
import 'package:auvora_wallet/ui/send_flow_screen.dart';
import 'package:auvora_wallet/wallet_engine/evm_json_rpc.dart';
import 'package:auvora_wallet/wallet_engine/evm_testnet_broadcast.dart';
import 'package:flutter_test/flutter_test.dart';

/// Regression for first physical Local EVM QA sign failure:
/// biometric overlay pauses Activity → AppShell auto-lock → mnemonic() null
/// → QuoteException → generic "Nothing was sent" with no broadcast.
void main() {
  test('suppressAutoLock prevents WalletController.lock during transfer auth', () async {
    final wallet = WalletController();
    wallet.hasPin = true;
    wallet.unlocked = true;
    wallet.stage = AppStage.dashboard;
    wallet.suppressAutoLock = true;
    await wallet.lock();
    expect(wallet.unlocked, isTrue);
    expect(wallet.stage, AppStage.dashboard);
  });

  test('lock still works when suppressAutoLock is false', () async {
    final wallet = WalletController();
    wallet.hasPin = true;
    wallet.unlocked = true;
    wallet.stage = AppStage.dashboard;
    wallet.suppressAutoLock = false;
    await wallet.lock();
    expect(wallet.unlocked, isFalse);
    expect(wallet.stage, AppStage.unlock);
  });

  test('unlockSessionForTransfer restores dashboard signing session', () {
    final wallet = WalletController();
    wallet.hasPin = true;
    wallet.unlocked = false;
    wallet.stage = AppStage.unlock;
    wallet.unlockSessionForTransfer();
    expect(wallet.unlocked, isTrue);
    expect(wallet.stage, AppStage.dashboard);
  });

  test('customer copy maps unavailable keys without raw exceptions', () {
    final msg = SendFlowScreen.customerSendFailureMessageForTest(
      QuoteException('Wallet keys are unavailable on this device.'),
    );
    expect(msg.toLowerCase(), contains('could not be signed'));
    expect(msg.toLowerCase(), contains('nothing was sent'));
    expect(msg.toLowerCase(), isNot(contains('mnemonic')));
  });

  test('customer copy maps RPC failure without raw payload', () {
    final msg = SendFlowScreen.customerSendFailureMessageForTest(
      RpcBalanceException('JSON-RPC error'),
    );
    expect(msg, contains('Network temporarily unavailable'));
    expect(msg.toLowerCase(), contains('nothing was broadcast'));
  });

  test('0.0001 ETH encodes to exact wei for local QA amount', () {
    expect(EvmAmountCodec.ethToWei(0.0001), BigInt.from(100000000000000));
  });

  test('local signer produces bytes for chain 31337', () {
    const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    final signed = const EvmLocalSigner().signLegacyNativeTransfer(
      mnemonic: mnemonic,
      to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      valueWei: EvmAmountCodec.ethToWei(0.0001),
      nonce: 0,
      gasPriceWei: BigInt.from(1000000000),
      chainId: 31337,
    );
    expect(signed.length, greaterThan(64));
    final from = WalletCrypto.deriveAddressForNetwork(mnemonic, AssetNetwork.ethereum);
    expect(from.toLowerCase(), startsWith('0x'));
    expect(from.toLowerCase().length, 42);
    expect(EvmTestnetBroadcast.allowlistedTestnetChainIds, contains(31337));
    expect(EvmTestnetBroadcast.mainnetChainIds, isNot(contains(31337)));
  });
}
