import 'package:auvora_wallet/crypto/wallet_crypto.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/wallet_engine/asset_registry.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/wallet_engine/price_service.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('asset registry exposes new multi-chain metadata', () {
    final registry = AssetRegistry();

    expect(registry.bySymbolOnChain('BNB', ChainId.bnbSmartChain)?.displayName, 'BNB');
    expect(registry.bySymbolOnChain('TRX', ChainId.tron)?.displayName, 'Tron');
    expect(registry.bySymbolOnChain('USDC', ChainId.solana)?.displayName, 'USD Coin');
    expect(
      registry.holdingId(registry.bySymbolOnChain('USDC', ChainId.ethereum)!, ChainId.ethereum),
      isNot(
        registry.holdingId(registry.bySymbolOnChain('USDC', ChainId.solana)!, ChainId.solana),
      ),
    );
  });

  test('price service returns cached quotes and offline stale fallback', () async {
    final service = PriceService();
    await service.bootstrap();
    final live = await service.quote('ETH');
    expect(live.priceUsd, greaterThan(0));
    expect(live.stale, isFalse);

    await service.markOfflineFallback();
    final stale = await service.quote('ETH');
    expect(stale.priceUsd, live.priceUsd);
    expect(stale.stale, isTrue);
  });

  test('wallet crypto derives chain-specific preview addresses', () {
    const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    final eth = WalletCrypto.deriveAddressForNetwork(mnemonic, AssetNetwork.ethereum);
    final btc = WalletCrypto.deriveAddressForNetwork(mnemonic, AssetNetwork.bitcoin);
    final sol = WalletCrypto.deriveAddressForNetwork(mnemonic, AssetNetwork.solana);
    final tron = WalletCrypto.deriveAddressForNetwork(mnemonic, AssetNetwork.tron);

    expect(eth.startsWith('0x'), isTrue);
    expect(btc.startsWith('bc1'), isTrue);
    expect(sol.startsWith('0x'), isFalse);
    expect(tron.startsWith('T'), isTrue);
  });
}
