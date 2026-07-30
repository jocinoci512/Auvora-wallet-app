import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'portfolio/portfolio_controller.dart';
import 'state/wallet_controller.dart';
import 'theme/aether_theme.dart';
import 'transfer/address_book.dart';
import 'ui/app_shell.dart';

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
        ChangeNotifierProvider(create: (_) => WalletController()),
        ChangeNotifierProvider(create: (_) => PortfolioController()),
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
