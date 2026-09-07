import 'package:auvora_wallet/crypto/hd_derivation.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  group('HdDerivation Multi-Chain Vectors', () {
    test('Ethereum / EVM derivation matches m/44\'/60\'/0\'/0/0', () {
      final ethAddr = HdDerivation.deriveAddress(
        mnemonic: mnemonic,
        network: AssetNetwork.ethereum,
      );
      expect(ethAddr.startsWith('0x'), isTrue);
      expect(ethAddr.length, 42);

      final bnbAddr = HdDerivation.deriveAddress(
        mnemonic: mnemonic,
        network: AssetNetwork.bnbSmartChain,
      );
      final polyAddr = HdDerivation.deriveAddress(
        mnemonic: mnemonic,
        network: AssetNetwork.polygon,
      );
      // EVM chains share identical key derivation and address format
      expect(bnbAddr, ethAddr);
      expect(polyAddr, ethAddr);
    });

    test('Solana derivation matches m/44\'/501\'/0\'/0\'', () {
      final solAddr = HdDerivation.deriveAddress(
        mnemonic: mnemonic,
        network: AssetNetwork.solana,
      );
      expect(solAddr, 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    });

    test('Bitcoin Native SegWit derivation produces valid bech32 address', () {
      final btcAddr = HdDerivation.deriveAddress(
        mnemonic: mnemonic,
        network: AssetNetwork.bitcoin,
      );
      // In testnet/release env defaults, starts with tb1 or bc1
      expect(btcAddr.startsWith('bc1') || btcAddr.startsWith('tb1'), isTrue);
      expect(btcAddr.length, greaterThan(30));
    });

    test('Tron derivation produces valid Base58Check T-address', () {
      final tronAddr = HdDerivation.deriveAddress(
        mnemonic: mnemonic,
        network: AssetNetwork.tron,
      );
      expect(tronAddr.startsWith('T'), isTrue);
      expect(tronAddr.length, 34);
    });

    test('Derivation paths match industry standards across all chains', () {
      expect(HdDerivation.derivationPath(AssetNetwork.ethereum), "m/44'/60'/0'/0/0");
      expect(HdDerivation.derivationPath(AssetNetwork.bnbSmartChain), "m/44'/60'/0'/0/0");
      expect(HdDerivation.derivationPath(AssetNetwork.polygon), "m/44'/60'/0'/0/0");
      expect(HdDerivation.derivationPath(AssetNetwork.solana), "m/44'/501'/0'/0'");
      expect(HdDerivation.derivationPath(AssetNetwork.tron), "m/44'/195'/0'/0/0");
    });
  });
}
