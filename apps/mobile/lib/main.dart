import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'connections/connections_controller.dart';
import 'connections/deep_link_router.dart';
import 'intelligence/intelligence_controller.dart';
import 'portfolio/portfolio_controller.dart';
import 'portfolio/portfolio_repository.dart';
import 'preferences/models.dart';
import 'preferences/preferences_controller.dart';
import 'security/security_controller.dart';
import 'state/wallet_controller.dart';
import 'theme/aether_theme.dart';
import 'transfer/address_book.dart';
import 'ui/app_shell.dart';
import 'ui/connections/deep_link_listener.dart';
import 'wallet_engine/asset_registry.dart';
import 'wallet_engine/blockchain_adapter.dart';
import 'wallet_engine/key_store.dart';
import 'wallet_engine/network_manager.dart';
import 'wallet_engine/price_service.dart';
import 'wallet_engine/sync_coordinator.dart';
import 'wallet_engine/sync_engine.dart';
import 'wallet_engine/transaction_engine.dart';
import 'wallet_engine/models.dart';
import 'wallet_engine/wallet_engine.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
    ),
  );
  runApp(const AuvoraApp());
}

class AuvoraApp extends StatelessWidget {
  const AuvoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider(create: (_) => AssetRegistry()),
        Provider(
          create: (_) => BlockchainLayer(
            adapters: [
              PreviewBlockchainAdapter(
                chain: ChainId.bitcoin,
                providerCode: 'btc-sim',
                explorerBaseUrl: 'https://mempool.space/tx/',
              ),
              PreviewBlockchainAdapter(
                chain: ChainId.ethereum,
                providerCode: 'eth-sim',
                explorerBaseUrl: 'https://etherscan.io/tx/',
              ),
              PreviewBlockchainAdapter(
                chain: ChainId.solana,
                providerCode: 'sol-sim',
                explorerBaseUrl: 'https://solscan.io/tx/',
              ),
              PreviewBlockchainAdapter(
                chain: ChainId.bnbSmartChain,
                providerCode: 'bsc-sim',
                explorerBaseUrl: 'https://bscscan.com/tx/',
              ),
              PreviewBlockchainAdapter(
                chain: ChainId.tron,
                providerCode: 'tron-sim',
                explorerBaseUrl: 'https://tronscan.org/#/transaction/',
              ),
              PreviewBlockchainAdapter(
                chain: ChainId.polygon,
                providerCode: 'polygon-sim',
                explorerBaseUrl: 'https://polygonscan.com/tx/',
              ),
            ],
          ),
        ),
        Provider(create: (_) => SecureKeyStore()),
        ChangeNotifierProvider(
          create: (context) => NetworkManager(
            blockchainLayer: context.read<BlockchainLayer>(),
          ),
        ),
        Provider(create: (_) => PriceService()),
        Provider(
          create: (context) => WalletEngine(
            keyStore: context.read<SecureKeyStore>(),
            blockchainLayer: context.read<BlockchainLayer>(),
          ),
        ),
        ProxyProvider2<WalletEngine, BlockchainLayer, TransactionEngine>(
          update: (_, walletEngine, blockchainLayer, __) => TransactionEngine(
            walletEngine: walletEngine,
            blockchainLayer: blockchainLayer,
          ),
        ),
        ProxyProvider5<WalletEngine, BlockchainLayer, AssetRegistry, PriceService, NetworkManager, SyncEngine>(
          update: (_, walletEngine, blockchainLayer, assetRegistry, priceService, networkManager, __) => SyncEngine(
            walletEngine: walletEngine,
            blockchainLayer: blockchainLayer,
            assetRegistry: assetRegistry,
            priceService: priceService,
            networkManager: networkManager,
          ),
        ),
        ProxyProvider<SyncEngine, PortfolioRepository>(
          update: (_, syncEngine, __) => PortfolioRepository(syncEngine: syncEngine),
        ),
        ChangeNotifierProxyProvider<WalletEngine, WalletController>(
          create: (_) => WalletController(),
          update: (_, walletEngine, controller) => controller!..attachEngine(walletEngine),
        ),
        ChangeNotifierProxyProvider<PortfolioRepository, PortfolioController>(
          create: (_) => PortfolioController(),
          update: (_, repository, controller) => controller!..attachRepository(repository),
        ),
        ChangeNotifierProxyProvider<PortfolioController, PreferencesController>(
          create: (_) {
            final controller = PreferencesController();
            // ignore: discarded_futures
            controller.bootstrap();
            return controller;
          },
          update: (_, portfolio, controller) => controller!..attachPortfolio(portfolio),
        ),
        ChangeNotifierProxyProvider4<SyncEngine, NetworkManager, PortfolioController,
            PreferencesController, SyncCoordinator>(
          create: (context) => SyncCoordinator(
            syncEngine: context.read<SyncEngine>(),
            networkManager: context.read<NetworkManager>(),
            portfolio: context.read<PortfolioController>(),
            preferences: context.read<PreferencesController>(),
          ),
          update: (_, syncEngine, networkManager, portfolio, preferences, coordinator) {
            coordinator ??= SyncCoordinator(
              syncEngine: syncEngine,
              networkManager: networkManager,
              portfolio: portfolio,
              preferences: preferences,
            );
            coordinator.attachPreferences(preferences);
            return coordinator;
          },
        ),
        ChangeNotifierProvider(create: (_) => ConnectionsController()),
        ChangeNotifierProvider(create: (_) => DeepLinkRouter()),
        ChangeNotifierProvider(
          create: (_) {
            final controller = IntelligenceController();
            // ignore: discarded_futures
            controller.bootstrap();
            return controller;
          },
        ),
        ChangeNotifierProxyProvider3<WalletController, WalletEngine, ConnectionsController, SecurityController>(
          create: (_) => SecurityController(),
          update: (_, walletController, walletEngine, connections, controller) => controller!
            ..attach(walletController: walletController, walletEngine: walletEngine)
            ..attachConnections(connections),
        ),
        ChangeNotifierProvider(create: (_) => AddressBookStore()),
      ],
      child: Consumer<PreferencesController>(
        builder: (context, prefs, _) {
          final a11y = prefs.accessibility;
          final scale = a11y.textScale.clamp(0.85, 1.35);
          final light = buildAetherTheme(
            brightness: Brightness.light,
            highContrast: a11y.highContrast,
            largeTouchTargets: a11y.largeTouchTargets,
            accentColor: accentColorFor(prefs.accent),
          );
          final dark = buildAetherTheme(
            brightness: Brightness.dark,
            highContrast: a11y.highContrast,
            largeTouchTargets: a11y.largeTouchTargets,
            accentColor: accentColorFor(prefs.accent),
          );
          return MaterialApp(
            title: 'Auvora Wallet',
            debugShowCheckedModeBanner: false,
            theme: light,
            darkTheme: dark,
            themeMode: prefs.materialThemeMode,
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [
              Locale('en'),
            ],
            locale: Locale(prefs.locale.languageCode, prefs.locale.regionCode),
            builder: (context, child) {
              final media = MediaQuery.of(context);
              return MediaQuery(
                data: media.copyWith(
                  textScaler: TextScaler.linear(
                    (media.textScaler.scale(1.0) * scale).clamp(0.85, 1.6),
                  ),
                  boldText: a11y.highContrast ? true : media.boldText,
                ),
                child: AnimatedTheme(
                  data: Theme.of(context),
                  duration: a11y.reduceMotion ? Duration.zero : const Duration(milliseconds: 220),
                  child: DeepLinkListener(child: child ?? const SizedBox.shrink()),
                ),
              );
            },
            home: const AppShell(),
          );
        },
      ),
    );
  }
}
