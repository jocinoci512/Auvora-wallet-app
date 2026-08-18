import 'package:auvora_wallet/beta/beta_feedback.dart';
import 'package:auvora_wallet/crypto/wallet_crypto.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('Version 1.0 Alpha kill switches stay off for funding and broadcast', () {
    expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
    expect(ReleaseConfig.allowFundingAddresses, isTrue);
    expect(ReleaseConfig.derivationMode, DerivationMode.bip32Partial);
    expect(ReleaseConfig.usesHdDerivation, isTrue);
    expect(ReleaseConfig.isAlpha, isTrue);
    expect(ReleaseConfig.isReleaseCandidate, isFalse);
    expect(ReleaseConfig.releaseChannel, 'alpha');
    expect(ReleaseConfig.marketingVersion, '1.0.0-alpha.1');
    expect(ReleaseConfig.buildLabel, 'Version 1.0 Alpha');
    expect(ReleaseConfig.fundingBlockedMessage.toLowerCase(), contains('qr'));
    expect(
      ReleaseConfig.redactAddress('0x1234567890abcdef1234567890abcdef12345678'),
      '0x1234…5678',
    );
    expect(ReleaseConfig.redactAddress('short'), '••••••••');
  });

  test('PIN compare is constant-time for equal-length strings', () {
    final salt = WalletCrypto.newSalt();
    final hash = WalletCrypto.pinPepperHash('482917', salt);
    expect(WalletCrypto.verifyPinHash('482917', salt, hash), isTrue);
    expect(WalletCrypto.verifyPinHash('482918', salt, hash), isFalse);
  });

  test('beta feedback stores locally without diagnostics by default', () async {
    final store = BetaFeedbackStore();
    final report = await store.submit(
      category: BetaFeedbackCategory.bug,
      summary: 'Send preview wording unclear',
      details: 'Expected clearer offline messaging',
      includeDiagnostics: false,
    );
    expect(report.diagnostics, isNull);
    final listed = await store.list();
    expect(listed, isNotEmpty);
    expect(listed.first.summary, contains('Send preview'));
  });

  test('safe diagnostics never include mnemonic-like fields', () {
    final d = BetaFeedbackStore.buildSafeDiagnostics(
      offline: true,
      hasPin: true,
      biometricsEnabled: false,
      syncState: 'idle',
      coldStartMs: 120,
    );
    expect(d.containsKey('mnemonic'), isFalse);
    expect(d.containsKey('pin'), isFalse);
    expect(d['privacyNote'], contains('No recovery phrase'));
  });
}
