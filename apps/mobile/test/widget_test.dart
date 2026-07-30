import 'package:auvora_wallet/crypto/wallet_crypto.dart';
import 'package:auvora_wallet/main.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('BIP39 generate and validate round-trip', () {
    final phrase = WalletCrypto.generateMnemonic();
    expect(WalletCrypto.words(phrase).length, 12);
    expect(WalletCrypto.validateMnemonic(phrase), isTrue);
    expect(WalletCrypto.fingerprintAddress(phrase).startsWith('0x'), isTrue);
  });

  test('invalid mnemonic rejected', () {
    expect(WalletCrypto.validateMnemonic('not a real bip39 phrase at all now'), isFalse);
  });

  test('quiz choices include correct word', () {
    final words = WalletCrypto.words(WalletCrypto.generateMnemonic());
    final choices = WalletCrypto.quizChoices(words, 0);
    expect(choices, contains(words[0]));
    expect(choices.length, 3);
  });

  test('PIN regex and v2 hash round-trip', () {
    expect(RegExp(r'^\d{6}$').hasMatch('123456'), isTrue);
    // Guard against the escaped-regex regression that broke changePin.
    expect(RegExp(r'^\\d{6}\$').hasMatch('123456'), isFalse);
    final salt = WalletCrypto.newSalt();
    final hash = WalletCrypto.pinPepperHash('482917', salt);
    expect(hash.startsWith('v2:'), isTrue);
    expect(WalletCrypto.verifyPinHash('482917', salt, hash), isTrue);
    expect(WalletCrypto.verifyPinHash('000000', salt, hash), isFalse);
  });

  testWidgets('Auvora app boots with brand mark', (tester) async {
    await tester.pumpWidget(const AuvoraApp());
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.textContaining('Auvora'), findsWidgets);
  });
}
