import 'package:flutter_test/flutter_test.dart';
import 'package:auvora_wallet/crypto/hd_derivation.dart';
import 'package:auvora_wallet/portfolio/models.dart';

void main() {
  test('abandon mnemonic Solana LOCAL QA recipient address', () {
    const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    final addr = HdDerivation.deriveAddress(
      mnemonic: mnemonic,
      network: AssetNetwork.solana,
    );
    // Print for QA recipient constant wiring (public only).
    // ignore: avoid_print
    print('LOCAL_QA_SOLANA_RECIPIENT=$addr');
    expect(addr.isNotEmpty, isTrue);
    expect(addr.startsWith('0x'), isFalse);
  });

  test('derivation path is m/44\'/501\'/0\'/0\'', () {
    expect(
      HdDerivation.derivationPath(AssetNetwork.solana),
      "m/44'/501'/0'/0'",
    );
  });
}
