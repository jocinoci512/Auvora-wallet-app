import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'connections/connections_controller.dart';
import 'connections/deep_link_router.dart';
import 'connections/wallet_connect_bootstrap.dart';
import 'connections/wallet_connect_provider.dart';
import 'connections/wc_chain_catalog.dart';
import 'intelligence/intelligence_controller.dart';
import 'portfolio/portfolio_controller.dart';
import 'portfolio/portfolio_repository.dart';
import 'preferences/models.dart';
import 'preferences/preferences_controller.dart';
import 'release/integration_config.dart';
import 'reliability/startup_timing.dart';
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
  StartupTiming.markAppStart();
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

  // Never block first frame on Reown WalletKit (can take many seconds on
  // Android). Preview shell is instant; live upgrade runs after first paint.
  // Never log WC_PROJECT_ID value. Never inject Alchemy key here.
  final wcBootstrap = WalletConnectBootstrap.previewShell(
    projectId: IntegrationConfig.wcProjectId,
  );
  StartupTiming.mark('runApp');
  runApp(AuvoraApp(wcBootstrap: wcBootstrap));
}

class AuvoraApp extends StatefulWidget {
  AuvoraApp({
    super.key,
    WalletConnectBootstrapResult? wcBootstrap,
  }) : wcBootstrap = wcBootstrap ??
            WalletConnectBootstrapResult(
              provider: PreviewWalletConnectProvider(),
              liveInitAttempted: false,
              liveInitSucceeded: false,
              fallbackReason: 'test/default preview',
            );

  final WalletConnectBootstrapResult wcBootstrap;

  @override
  State<AuvoraApp> createState() => _AuvoraAppState();
}

class _AuvoraAppState extends State<AuvoraApp> {
  late WalletConnectBootstrapResult _wcBootstrap;
  bool _liveUpgradeStarted = false;
  ThemeData? _cachedLight;
  ThemeData? _cachedDark;
  Object? _themeCacheKey;

  @override
  void initState() {
    super.initState();
    _wcBootstrap = widget.wcBootstrap;
    if (_wcBootstrap.liveInitDeferred) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        // ignore: discarded_futures
        _upgradeWalletConnect();
      });
    }
  }

  Future<void> _upgradeWalletConnect() async {
    if (_liveUpgradeStarted || !mounted) return;
    _liveUpgradeStarted = true;
    StartupTiming.mark('wcLiveInitStart');
    final result = await WalletConnectBootstrap.upgradeToLive(
      projectId: IntegrationConfig.wcProjectId,
    );
    StartupTiming.mark('wcLiveInitDone');
    if (!mounted) {
      await result.provider.dispose();
      return;
    }
    setState(() => _wcBootstrap = result);
  }

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
          update: (_, walletEngine, blockchainLayer, assetRegistry, priceService, networkManager, previous) {
            // Reuse the same SyncEngine so coordinator diagnostics and portfolio
            // refreshes share one cache / status surface across rebuilds.
            return previous ??
                SyncEngine(
                  walletEngine: walletEngine,
                  blockchainLayer: blockchainLayer,
                  assetRegistry: assetRegistry,
                  priceService: priceService,
                  networkManager: networkManager,
                );
          },
        ),
        ProxyProvider<SyncEngine, PortfolioRepository>(
          update: (_, syncEngine, previous) => previous ?? PortfolioRepository(syncEngine: syncEngine),
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
        ChangeNotifierProvider(
          create: (_) {
            final c = ConnectionsController(walletConnect: _wcBootstrap.provider);
            c.liveRelayStatus = _wcBootstrap.usingLiveRelay
                ? 'Live Reown WalletKit'
                : (_wcBootstrap.fallbackReason ?? 'Preview WalletConnect');
            c.bootstrapFallbackReason = _wcBootstrap.fallbackReason;
            // ignore: discarded_futures
            c.bootstrap();
            return c;
          },
        ),
        ChangeNotifierProvider(
          create: (_) => DeepLinkRouter(provider: _wcBootstrap.provider),
        ),
        ChangeNotifierProxyProvider2<WalletController, ConnectionsController, _WcAccountBinder>(
          create: (_) => _WcAccountBinder(_wcBootstrap),
          update: (_, wallet, connections, binder) =>
              binder!..bind(wallet: wallet, connections: connections, bootstrap: _wcBootstrap),
        ),
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
        // Applies deferred live WC provider without rebuilding the whole tree.
        ChangeNotifierProxyProvider2<ConnectionsController, DeepLinkRouter, _WcLiveUpgrader>(
          create: (_) => _WcLiveUpgrader(),
          update: (_, connections, deepLinks, upgrader) => upgrader!
            ..apply(
              connections: connections,
              deepLinks: deepLinks,
              bootstrap: _wcBootstrap,
            ),
        ),
      ],
      child: Consumer<PreferencesController>(
        builder: (context, prefs, _) {
          // Ensure WC account registration + mnemonic binding when wallet unlocks.
          context.watch<_WcAccountBinder>();
          context.watch<_WcLiveUpgrader>();
          final a11y = prefs.accessibility;
          final scale = a11y.textScale.clamp(0.85, 1.35);
          // GoogleFonts + ThemeData copy is expensive — rebuild only when inputs change.
          final themeKey = (
            a11y.highContrast,
            a11y.largeTouchTargets,
            prefs.accent,
          );
          if (_themeCacheKey != themeKey || _cachedLight == null || _cachedDark == null) {
            _themeCacheKey = themeKey;
            final accent = accentColorFor(prefs.accent);
            _cachedLight = buildAetherTheme(
              brightness: Brightness.light,
              highContrast: a11y.highContrast,
              largeTouchTargets: a11y.largeTouchTargets,
              accentColor: accent,
            );
            _cachedDark = buildAetherTheme(
              brightness: Brightness.dark,
              highContrast: a11y.highContrast,
              largeTouchTargets: a11y.largeTouchTargets,
              accentColor: accent,
            );
          }
          return MaterialApp(
            title: 'Auvora Wallet',
            debugShowCheckedModeBanner: false,
            theme: _cachedLight!,
            darkTheme: _cachedDark!,
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

/// Swaps ConnectionsController onto the live provider once deferred Reown init
/// completes. Scheduled post-frame — never starts async work during build.
class _WcLiveUpgrader extends ChangeNotifier {
  WalletConnectBootstrapResult? _applied;
  bool _attachScheduled = false;

  void apply({
    required ConnectionsController connections,
    required DeepLinkRouter deepLinks,
    required WalletConnectBootstrapResult bootstrap,
  }) {
    if (identical(_applied?.provider, bootstrap.provider) &&
        _applied?.liveInitSucceeded == bootstrap.liveInitSucceeded &&
        _applied?.liveInitDeferred == bootstrap.liveInitDeferred) {
      return;
    }
    if (bootstrap.liveInitDeferred) {
      _applied = bootstrap;
      return;
    }
    if (_attachScheduled) return;
    _attachScheduled = true;
    final target = bootstrap;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      _attachScheduled = false;
      if (identical(_applied?.provider, target.provider)) return;
      _applied = target;
      deepLinks.attachProvider(target.provider);
      await connections.attachWalletConnectProvider(
        target.provider,
        fallbackReason: target.fallbackReason,
      );
      notifyListeners();
    });
  }
}

/// Registers EVM CAIP accounts with Reown and binds mnemonic for local WC signing.
class _WcAccountBinder extends ChangeNotifier {
  _WcAccountBinder(this._bootstrap);

  WalletConnectBootstrapResult _bootstrap;
  String? _lastAddress;
  bool _boundMnemonic = false;
  bool _lastLive = false;

  void bind({
    required WalletController wallet,
    required ConnectionsController connections,
    required WalletConnectBootstrapResult bootstrap,
  }) {
    _bootstrap = bootstrap;

    if (!_boundMnemonic) {
      connections.attachMnemonicProvider(() async {
        try {
          return await wallet.revealRecoveryPhrase();
        } catch (_) {
          return null;
        }
      });
      _boundMnemonic = true;
    }

    final address = wallet.address;
    final live = _bootstrap.usingLiveRelay;
    if (address == null || address.isEmpty) return;
    if (!live) return;
    if (address == _lastAddress && live == _lastLive) return;
    _lastAddress = address;
    _lastLive = live;

    final accounts = <String, String>{
      for (final caip in WcChainCatalog.supportedEip155Chains) caip: address,
    };
    // Same ETH derivation for BSC/Polygon (m/44'/60').
    // ignore: discarded_futures
    connections.walletConnect.registerAccounts(accounts);
  }
}
