import 'package:auvora_wallet/state/wallet_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('createAdditionalWallet rejects persistence without backup quiz', () async {
    final controller = WalletController();
    final result = await controller.createAdditionalWallet(
      mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      backupQuizPassed: false,
    );
    expect(result, isNull);
    expect(controller.errorMessage, contains('Confirm each recovery word'));
  });
}
