import 'dart:io';

import 'package:auvora_wallet/connections/connections_controller.dart';
import 'package:auvora_wallet/intelligence/intelligence_controller.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/portfolio/portfolio_controller.dart';
import 'package:auvora_wallet/preferences/preferences_controller.dart';
import 'package:auvora_wallet/security/security_controller.dart';
import 'package:auvora_wallet/state/wallet_controller.dart';
import 'package:auvora_wallet/theme/aether_theme.dart';
import 'package:auvora_wallet/transfer/address_book.dart';
import 'package:auvora_wallet/ui/connections/connect_dapp_screen.dart';
import 'package:auvora_wallet/ui/home/assets_tab.dart';
import 'package:auvora_wallet/ui/home/home_tab.dart';
import 'package:auvora_wallet/ui/receive_flow_screen.dart';
import 'package:auvora_wallet/ui/security/security_center_screen.dart';
import 'package:auvora_wallet/ui/send_flow_screen.dart';
import 'package:auvora_wallet/wallet_engine/blockchain_adapter.dart';
import 'package:auvora_wallet/wallet_engine/models.dart';
import 'package:auvora_wallet/wallet_engine/network_manager.dart';
import 'package:auvora_wallet/wallet_engine/price_service.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Captures Play listing graphics from the current Flutter UI into
/// `release/google-play/` (paths are relative to this test file).
/// Demo portfolio data only — no seed phrases or live keys.
const _phone = Size(1080, 1920);
const _captureKey = ValueKey('play-capture');
const _goldenRoot = '../../../release/google-play';

const _demoFrom = '0x1111111111111111111111111111111111111111';
const _demoTo = '0x2222222222222222222222222222222222222222';

ThemeData _playTheme() {
  final base = ThemeData(useMaterial3: true, brightness: Brightness.light);
  const primary = AetherColors.lagoon;
  return base.copyWith(
    colorScheme: ColorScheme.fromSeed(seedColor: primary, brightness: Brightness.light).copyWith(
      primary: primary,
      onPrimary: Colors.white,
      secondary: AetherColors.lagoonSoft,
      surface: AetherColors.surface,
      onSurface: AetherColors.ink,
    ),
    scaffoldBackgroundColor: AetherColors.mist,
    appBarTheme: const AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      backgroundColor: Colors.transparent,
      foregroundColor: AetherColors.ink,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  if (Platform.environment['AUVORA_PLAY_CAPTURE'] != '1') {
    test('play store capture skipped unless AUVORA_PLAY_CAPTURE=1', () {});
    return;
  }
  autoUpdateGoldenFiles = true;

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      null,
    );
  });

  testWidgets('capture Play Store icon, feature graphic, and phone screenshots', (tester) async {
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await _capture(tester, size: const Size(512, 512), golden: '$_goldenRoot/icon/play-icon-512.png', child: const _PlayIcon());
    expect(find.text('A'), findsOneWidget);

    await _capture(
      tester,
      size: const Size(1024, 500),
      golden: '$_goldenRoot/feature-graphic/feature-graphic-1024x500.png',
      child: const _PlayFeatureGraphic(),
    );
    expect(find.text('Auvora Wallet'), findsOneWidget);

    final wallet = WalletController()
      ..reduceMotion = true
      ..hasPin = true
      ..biometricsEnabled = true
      ..address = _demoFrom
      ..unlocked = true;

    final portfolio = PortfolioController();
    portfolio.loading = false;
    portfolio.snapshot = _demoSnapshot();

    final intel = IntelligenceController()..loading = false;
    final prefs = PreferencesController()..loading = false;
    final prices = PriceService(providers: const []);
    final connections = ConnectionsController()..loading = false;
    final security = SecurityController();
    security.attachConnections(connections);
    final book = AddressBookStore();
    final network = NetworkManager(
      blockchainLayer: BlockchainLayer(
        adapters: [
          for (final chain in ChainId.values)
            PreviewBlockchainAdapter(
              chain: chain,
              providerCode: 'preview',
              explorerBaseUrl: 'https://example.invalid',
            ),
        ],
      ),
    )..forceOffline = false;

    Widget wrap(Widget home, {int navIndex = 0}) {
      return MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: wallet),
          ChangeNotifierProvider.value(value: portfolio),
          ChangeNotifierProvider.value(value: intel),
          ChangeNotifierProvider.value(value: prefs),
          ChangeNotifierProvider.value(value: connections),
          ChangeNotifierProvider.value(value: security),
          ChangeNotifierProvider.value(value: book),
          ChangeNotifierProvider.value(value: network),
          Provider.value(value: prices),
        ],
        child: _PhoneChrome(navIndex: navIndex, child: home),
      );
    }

    await _capture(
      tester,
      size: _phone,
      golden: '$_goldenRoot/screenshots/01-portfolio-dashboard.png',
      child: wrap(
        HomeTab(
          onOpenAssets: () {},
          onOpenActivity: () {},
          onOpenSearch: () {},
          onOpenMore: () {},
        ),
      ),
    );
    expect(find.text('Your money'), findsOneWidget);

    await _capture(
      tester,
      size: _phone,
      golden: '$_goldenRoot/screenshots/02-multi-chain-assets.png',
      child: wrap(const AssetsTab(), navIndex: 1),
    );
    expect(find.text('Assets'), findsWidgets);
    expect(find.text('Ethereum'), findsWidgets);

    await _capture(
      tester,
      size: _phone,
      golden: '$_goldenRoot/screenshots/03-send-review.png',
      child: wrap(const SendFlowScreen(initialAssetId: 'eth', initialTo: _demoTo)),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Continue'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.enterText(find.byType(TextField).last, '0.05');
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.text('Review transfer'), findsOneWidget);
    await tester.tap(find.text('Review transfer'));
    await tester.pump(const Duration(milliseconds: 250));
    expect(find.text('Review'), findsOneWidget);
    await expectLater(find.byKey(_captureKey), matchesGoldenFile('$_goldenRoot/screenshots/03-send-review.png'));

    await _capture(
      tester,
      size: _phone,
      golden: '$_goldenRoot/screenshots/04-receive-locked.png',
      child: wrap(const ReceiveFlowScreen(initialAssetId: 'eth')),
    );
    expect(find.textContaining('Receive'), findsWidgets);

    await security.bootstrap();
    await tester.pump(const Duration(milliseconds: 80));
    await _capture(
      tester,
      size: _phone,
      golden: '$_goldenRoot/screenshots/05-security-center.png',
      child: wrap(const SecurityCenterScreen()),
    );
    expect(find.text('Security Center'), findsOneWidget);

    await _capture(
      tester,
      size: _phone,
      golden: '$_goldenRoot/screenshots/06-walletconnect.png',
      child: wrap(const ConnectDappScreen()),
    );
    expect(find.textContaining('WalletConnect'), findsWidgets);
  }, timeout: const Timeout(Duration(minutes: 2)));
}

PortfolioSnapshot _demoSnapshot() {
  return PortfolioSnapshot(
    assets: const [
      AssetHolding(
        id: 'eth',
        name: 'Ethereum',
        ticker: 'ETH',
        network: AssetNetwork.ethereum,
        balance: 1.25,
        priceUsd: 3240,
        change24hPct: 1.4,
        color: 0xFF627EEA,
        sparkline: [1.1, 1.15, 1.12, 1.2, 1.18, 1.22, 1.25],
      ),
      AssetHolding(
        id: 'btc',
        name: 'Bitcoin',
        ticker: 'BTC',
        network: AssetNetwork.bitcoin,
        balance: 0.042,
        priceUsd: 64210,
        change24hPct: 0.8,
        color: 0xFFF7931A,
        sparkline: [0.04, 0.041, 0.039, 0.04, 0.041, 0.042, 0.042],
      ),
      AssetHolding(
        id: 'sol',
        name: 'Solana',
        ticker: 'SOL',
        network: AssetNetwork.solana,
        balance: 18.5,
        priceUsd: 148,
        change24hPct: -0.6,
        color: 0xFF9945FF,
        sparkline: [19, 18.8, 18.2, 18.6, 18.4, 18.7, 18.5],
      ),
      AssetHolding(
        id: 'pol',
        name: 'Polygon',
        ticker: 'POL',
        network: AssetNetwork.polygon,
        balance: 420,
        priceUsd: 0.42,
        change24hPct: 2.1,
        color: 0xFF8247E5,
        sparkline: [400, 405, 410, 408, 415, 418, 420],
      ),
    ],
    transactions: [
      PortfolioTx(
        id: 'demo-tx-1',
        type: TxType.send,
        status: TxStatus.completed,
        network: AssetNetwork.ethereum,
        assetTicker: 'ETH',
        amount: 0.05,
        amountUsd: 162,
        timestamp: DateTime.utc(2026, 8, 1, 14, 30),
        from: _demoFrom,
        to: _demoTo,
        hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ),
    ],
    contacts: const [],
    trend7d: const [9800, 10100, 9950, 10400, 10650, 10520, 10780],
    change24hUsd: 86,
    change24hPct: 0.8,
    updatedAt: DateTime.utc(2026, 8, 16, 18, 0),
    isPreview: true,
  );
}

Future<void> _capture(
  WidgetTester tester, {
  required Size size,
  required String golden,
  required Widget child,
}) async {
  tester.view.physicalSize = size;
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: _playTheme(),
      home: MediaQuery(
        data: MediaQueryData(size: size, devicePixelRatio: 1, padding: const EdgeInsets.only(top: 36)),
        child: RepaintBoundary(key: _captureKey, child: child),
      ),
    ),
  );
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 80));
  await expectLater(find.byKey(_captureKey), matchesGoldenFile(golden));
}

class _PhoneChrome extends StatelessWidget {
  const _PhoneChrome({required this.child, this.navIndex = 0});
  final Widget child;
  final int navIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AetherColors.mist,
      body: SafeArea(child: child),
      bottomNavigationBar: DecoratedBox(
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          border: Border(top: BorderSide(color: AetherColors.borderFor(context).withValues(alpha: 0.85))),
        ),
        child: NavigationBar(
          selectedIndex: navIndex,
          onDestinationSelected: (_) {},
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home_rounded), label: 'Home'),
            NavigationDestination(icon: Icon(Icons.pie_chart_outline_rounded), selectedIcon: Icon(Icons.pie_chart_rounded), label: 'Assets'),
            NavigationDestination(icon: Icon(Icons.receipt_long_outlined), selectedIcon: Icon(Icons.receipt_long_rounded), label: 'Activity'),
            NavigationDestination(icon: Icon(Icons.person_outline_rounded), selectedIcon: Icon(Icons.person_rounded), label: 'More'),
          ],
        ),
      ),
    );
  }
}

class _PlayIcon extends StatelessWidget {
  const _PlayIcon();

  @override
  Widget build(BuildContext context) {
    return const DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF07262E), AetherColors.lagoonDeep, AetherColors.lagoon, Color(0xFF0A2E36)],
          stops: [0.0, 0.35, 0.72, 1.0],
        ),
      ),
      child: Center(
        child: SizedBox(
          width: 280,
          height: 280,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.fromBorderSide(BorderSide(color: Color(0x47FFFFFF), width: 3)),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0x2EFFFFFF), Color(0x0AFFFFFF)],
              ),
            ),
            child: Center(
              child: Text(
                'A',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 148,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -4,
                  height: 1,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PlayFeatureGraphic extends StatelessWidget {
  const _PlayFeatureGraphic();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF07262E), AetherColors.lagoonDeep, AetherColors.lagoon, Color(0xFF0A2E36)],
          stops: [0.0, 0.32, 0.7, 1.0],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -90,
            right: -40,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [AetherColors.lagoonSoft.withValues(alpha: 0.28), Colors.transparent]),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(72, 0, 72, 0),
            child: Row(
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white.withValues(alpha: 0.28), width: 1.4),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Colors.white.withValues(alpha: 0.18), Colors.white.withValues(alpha: 0.04)],
                    ),
                  ),
                  child: const Center(
                    child: Text('A', style: TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w700, letterSpacing: -1)),
                  ),
                ),
                const SizedBox(width: 28),
                const Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Auvora Wallet',
                        style: TextStyle(color: Colors.white, fontSize: 42, fontWeight: FontWeight.w700, letterSpacing: -1.4, height: 1),
                      ),
                      SizedBox(height: 14),
                      Text(
                        'Quiet custody for digital value',
                        style: TextStyle(color: AetherColors.lagoonMist, fontSize: 20, fontWeight: FontWeight.w500, height: 1.3),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
