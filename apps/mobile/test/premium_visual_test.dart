import 'package:auvora_wallet/main.dart';
import 'package:auvora_wallet/ui/splash_screen.dart';
import 'package:auvora_wallet/ui/unlock_screen.dart';
import 'package:auvora_wallet/ui/welcome_screen.dart';
import 'package:auvora_wallet/state/wallet_controller.dart';
import 'package:auvora_wallet/theme/aether_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Phone-canvas smoke checks for premium first screens (shared Android/iOS UI).
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

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

  Future<void> pumpPhone(WidgetTester tester, Widget child) async {
    tester.view.physicalSize = const Size(1170, 2532);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    // Avoid GoogleFonts network/assets in unit tests — still validate layout + brand copy.
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AetherColors.lagoon,
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: AetherColors.mist,
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: base,
        home: child,
      ),
    );
  }

  testWidgets('splash brand reads premium on phone canvas', (tester) async {
    await pumpPhone(
      tester,
      ChangeNotifierProvider(
        create: (_) => WalletController(),
        child: const SplashScreen(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 950));
    expect(find.text('Auvora'), findsOneWidget);
    expect(find.textContaining('Quiet custody'), findsOneWidget);
    expect(find.text('A'), findsOneWidget);
  });

  testWidgets('welcome brand-first layout on phone canvas', (tester) async {
    await pumpPhone(
      tester,
      ChangeNotifierProvider(
        create: (_) => WalletController(),
        child: const WelcomeScreen(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('Auvora'), findsOneWidget);
    expect(find.text('Create a new wallet'), findsOneWidget);
    expect(find.text('I already have a wallet'), findsOneWidget);
    expect(find.textContaining('Self-custody'), findsOneWidget);
  });

  testWidgets('unlock screen calm hierarchy', (tester) async {
    await pumpPhone(
      tester,
      ChangeNotifierProvider(
        create: (_) => WalletController(),
        child: const UnlockScreen(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.text('Auvora'), findsOneWidget);
    expect(find.textContaining('passcode'), findsOneWidget);
  });

  testWidgets('app cold boot shows Auvora brand', (tester) async {
    await tester.pumpWidget(AuvoraApp());
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 200));
    expect(find.textContaining('Auvora'), findsWidgets);
    // Drain any remaining bootstrap settle timers before dispose.
    await tester.pump(const Duration(seconds: 1));
  });
}
