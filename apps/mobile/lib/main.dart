import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'portfolio/portfolio_controller.dart';
import 'portfolio/portfolio_repository.dart';
import 'security/security_controller.dart';
import 'state/wallet_controller.dart';
import 'theme/aether_theme.dart';
import 'transfer/address_book.dart';
import 'ui/app_shell.dart';
import 'wallet_engine/asset_registry.dart';
import 'wallet_engine/blockchain_adapter.dart';
import 'wallet_engine/key_store.dart';
import 'wallet_engine/network_manager.dart';
import 'wallet_engine/price_service.dart';
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
        ChangeNotifierProxyProvider2<WalletController, WalletEngine, SecurityController>(
          create: (_) => SecurityController(),
          update: (_, walletController, walletEngine, controller) =>
              controller!..attach(walletController: walletController, walletEngine: walletEngine),
        ),
        ChangeNotifierProvider(create: (_) => AddressBookStore()),
      ],
      child: MaterialApp(
        title: 'Auvora Wallet',
        debugShowCheckedModeBanner: false,
        theme: buildAetherTheme(brightness: Brightness.light),
        darkTheme: buildAetherTheme(brightness: Brightness.dark),
        themeMode: ThemeMode.system,
        builder: (context, child) {
          final media = MediaQuery.of(context);
          return MediaQuery(
            data: media.copyWith(textScaler: media.textScaler.clamp(minScaleFactor: 1.0, maxScaleFactor: 1.35)),
            child: child ?? const SizedBox.shrink(),
          );
        },
        home: const AppShell(),
      ),
    );
  }
}
