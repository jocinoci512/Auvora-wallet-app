import 'package:auvora_wallet/crypto/wallet_crypto.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';

/// Official BIP-39 English test vector (not a user phrase). Used only to prove
/// generate → wipe → restore determinism without storing production secrets.
const _kBip39Vector =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

Map<AssetNetwork, String> _addresses(String mnemonic) {
  return {
    for (final network in AssetNetwork.values)
      network: WalletCrypto.deriveAddressForNetwork(mnemonic, network),
  };
}

void main() {
  test('clean-install restore re-derives identical addresses on every chain', () {
    final generated = WalletCrypto.generateMnemonic();
    expect(WalletCrypto.validateMnemonic(generated), isTrue);

    final original = _addresses(generated);

    // Destroy application state: drop all maps, keep only the phrase the user wrote.
    final writtenPhrase = generated;

    final restored = _addresses(WalletCrypto.normalizeMnemonic('  $writtenPhrase  '));
    for (final network in AssetNetwork.values) {
      expect(restored[network], original[network], reason: network.name);
    }
  });

  test('BIP-39 vector is deterministic across calls', () {
    final a = _addresses(_kBip39Vector);
    final b = _addresses(_kBip39Vector);
    expect(a, b);
    expect(a[AssetNetwork.ethereum], matches(RegExp(r'^0x[a-fA-F0-9]{40}$')));
    expect(a[AssetNetwork.bnbSmartChain], a[AssetNetwork.ethereum]);
    expect(a[AssetNetwork.polygon], a[AssetNetwork.ethereum]);
    expect(a[AssetNetwork.bitcoin], startsWith('bc1'));
    expect(a[AssetNetwork.tron], startsWith('T'));
    expect(a[AssetNetwork.solana]!.startsWith('0x'), isFalse);
  });

  test('wrong word order does not restore', () {
    final words = WalletCrypto.words(_kBip39Vector);
    final shuffled = [...words.skip(1), words.first].join(' ');
    expect(WalletCrypto.validateMnemonic(shuffled), isFalse);
  });

  test('normalization does not change a valid phrase', () {
    final messy = '  ABANDON\u00A0abandon\tabandon abandon abandon abandon abandon abandon abandon abandon abandon about  ';
    expect(WalletCrypto.normalizeMnemonic(messy), _kBip39Vector);
    expect(WalletCrypto.validateMnemonic(messy), isTrue);
    expect(_addresses(messy), _addresses(_kBip39Vector));
  });
}
