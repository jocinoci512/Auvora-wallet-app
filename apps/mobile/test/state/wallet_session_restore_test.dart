import 'package:auvora_wallet/state/wallet_controller.dart';
import 'package:auvora_wallet/state/wallet_session_restore.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _secureChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');

Map<String, String> installSecureStorageMock() {
  final data = <String, String>{};
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    _secureChannel,
    (call) async {
      final args = (call.arguments as Map?) ?? {};
      final key = args['key'] as String?;
      switch (call.method) {
        case 'write':
          data[key!] = args['value'] as String;
          return null;
        case 'read':
          return data[key];
        case 'delete':
          data.remove(key);
          return null;
        case 'readAll':
          return Map<String, String>.from(data);
        case 'deleteAll':
          data.clear();
          return null;
        case 'containsKey':
          return data.containsKey(key);
        default:
          return null;
      }
    },
  );
  return data;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Map<String, String> store;

  setUp(() {
    store = installSecureStorageMock();
    SharedPreferences.setMockInitialValues({});
  });

  group('WalletSessionRestore.decide', () {
    test('missing onboarded flag still unlocks when vault and pin exist', () {
      expect(
        WalletSessionRestore.decide(
          hasVault: true,
          hasAddress: true,
          hasPin: true,
          onboardingFlag: false,
          timedOut: false,
          bootstrapCompleted: true,
        ),
        WalletRestoreTarget.unlock,
      );
    });

    test('address and pin without onboarded flag unlock (app update)', () {
      expect(
        WalletSessionRestore.decide(
          hasVault: false,
          hasAddress: true,
          hasPin: true,
          onboardingFlag: false,
          timedOut: false,
          bootstrapCompleted: true,
        ),
        WalletRestoreTarget.unlock,
      );
    });

    test('empty completed restore is Welcome', () {
      expect(
        WalletSessionRestore.decide(
          hasVault: false,
          hasAddress: false,
          hasPin: false,
          onboardingFlag: false,
          timedOut: false,
          bootstrapCompleted: true,
        ),
        WalletRestoreTarget.welcome,
      );
    });

    test('timeout without evidence stays on splash (do not Welcome)', () {
      expect(
        WalletSessionRestore.decide(
          hasVault: false,
          hasAddress: false,
          hasPin: false,
          onboardingFlag: false,
          timedOut: true,
          bootstrapCompleted: false,
        ),
        WalletRestoreTarget.splash,
      );
    });

    test('onboarded flag with missing address still does not Welcome', () {
      expect(
        WalletSessionRestore.decide(
          hasVault: false,
          hasAddress: false,
          hasPin: true,
          onboardingFlag: true,
          timedOut: false,
          bootstrapCompleted: true,
        ),
        WalletRestoreTarget.unlock,
      );
    });
  });

  test('bootstrap heals missing onboarded flag and opens Unlock', () async {
    store['auvora_address_v1'] = '0xabc';
    store['auvora_pin_hash_v1'] = 'v2:hash';
    final c = WalletController();
    expect(c.stage, AppStage.splash);
    await c.bootstrap();
    expect(c.stage, AppStage.unlock);
    expect(c.onboardingComplete, isTrue);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('auvora_onboarded_v1'), isTrue);
  });

  test('startup stays splash until bootstrap finishes, then Welcome if empty', () async {
    final c = WalletController();
    expect(c.stage, AppStage.splash);
    await c.bootstrap();
    expect(c.stage, AppStage.welcome);
  });

  test('retryRestoreIfNeeded from walletChoice returns to Unlock when a local wallet exists', () async {
    store['auvora_address_v1'] = '0xabc';
    store['auvora_pin_hash_v1'] = 'v2:hash';
    final c = WalletController();
    await c.bootstrap();
    expect(c.stage, AppStage.unlock);
    c.goWalletChoice();
    expect(c.stage, AppStage.walletChoice);
    await c.retryRestoreIfNeeded();
    expect(c.stage, AppStage.unlock);
  });

  test('retryRestoreIfNeeded upgrades Welcome after storage appears', () async {
    final c = WalletController();
    await c.bootstrap();
    expect(c.stage, AppStage.welcome);
    store['auvora_address_v1'] = '0xabc';
    store['auvora_pin_hash_v1'] = 'v2:hash';
    await c.retryRestoreIfNeeded();
    expect(c.stage, AppStage.unlock);
  });

  test('explicit wipe clears wallet flags but resumeExistingSession is a no-op after', () async {
    store['auvora_address_v1'] = '0xabc';
    store['auvora_pin_hash_v1'] = 'v2:hash';
    final c = WalletController();
    await c.bootstrap();
    expect(c.stage, AppStage.unlock);
    await c.wipeLocalWallet();
    expect(c.stage, AppStage.welcome);
    expect(c.hasLocalWallet, isFalse);
    c.resumeExistingSession();
    expect(c.stage, AppStage.welcome);
  });
}
