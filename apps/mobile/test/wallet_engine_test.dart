import 'package:auvora_wallet/crypto/hd_derivation.dart';
import 'package:auvora_wallet/crypto/wallet_crypto.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:auvora_wallet/wallet_engine/asset_registry.dart';
import 'package:auvora_wallet/wallet_engine/market_data_provider.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/wallet_engine/price_service.dart';
import 'package:auvora_wallet/wallet_engine/seeded_market_data_provider.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('asset registry exposes multi-chain metadata', () {
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
    final service = PriceService(providers: [SeededMarketDataProvider()]);
    await service.bootstrap();
    final live = await service.quote('ETH');
    expect(live.priceUsd, greaterThan(0));
    expect(live.stale, isFalse);

    await service.markOfflineFallback();
    final stale = await service.quote('ETH');
    expect(stale.priceUsd, live.priceUsd);
    expect(stale.stale, isTrue);
  });

  test('price service history returns series for chart ranges', () async {
    final service = PriceService(providers: [SeededMarketDataProvider()]);
    await service.bootstrap();
    final series = await service.history('BTC', ChartRange.d30);
    expect(series.length, greaterThanOrEqualTo(7));
  });

  test('HD derivation produces chain-shaped addresses for all Prompt 2 networks', () {
    const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

    expect(ReleaseConfig.usesHdDerivation, isTrue);

    final eth = HdDerivation.deriveAddress(mnemonic: mnemonic, network: AssetNetwork.ethereum);
    final btc = HdDerivation.deriveAddress(mnemonic: mnemonic, network: AssetNetwork.bitcoin);
    final sol = HdDerivation.deriveAddress(mnemonic: mnemonic, network: AssetNetwork.solana);
    final bnb = HdDerivation.deriveAddress(mnemonic: mnemonic, network: AssetNetwork.bnbSmartChain);
    final tron = HdDerivation.deriveAddress(mnemonic: mnemonic, network: AssetNetwork.tron);

    expect(eth, matches(RegExp(r'^0x[a-fA-F0-9]{40}$')));
    expect(bnb, eth); // MetaMask-style shared EVM account path
    expect(btc, startsWith('bc1'));
    expect(btc.length, greaterThan(14));
    expect(sol.isNotEmpty, isTrue);
    expect(sol.startsWith('0x'), isFalse);
    expect(tron, startsWith('T'));
    expect(tron.length, greaterThan(25));

    // Deterministic across calls.
    expect(
      HdDerivation.deriveAddress(mnemonic: mnemonic, network: AssetNetwork.ethereum),
      eth,
    );
  });

  test('wallet crypto uses HD when derivation mode is bip32Partial', () {
    const mnemonic =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    final viaCrypto = WalletCrypto.deriveAddressForNetwork(mnemonic, AssetNetwork.ethereum);
    final viaHd = HdDerivation.deriveAddress(mnemonic: mnemonic, network: AssetNetwork.ethereum);
    expect(viaCrypto, viaHd);
  });
}
