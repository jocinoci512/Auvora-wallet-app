import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../account/vault_crypto.dart';
import '../crypto/wallet_crypto.dart';
import '../portfolio/models.dart';
import '../release/network_env.dart';
import '../reliability/startup_timing.dart';
import '../wallet_engine/key_store.dart';
import '../wallet_engine/models.dart';
import '../wallet_engine/wallet_engine.dart';
import 'wallet_session_restore.dart';

enum AppStage {
  splash,
  unlock,
  welcome,
  walletChoice,
  createExplain,
  createBackup,
  createVerify,
  importPhrase,
  securityPin,
  securityBiometric,
  permissions,
  dashboard,
}

class WalletController extends ChangeNotifier {
  WalletController({
    FlutterSecureStorage? secureStorage,
    LocalAuthentication? localAuth,
  })  : _secure = secureStorage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(
                encryptedSharedPreferences: true,
                sharedPreferencesName: 'FlutterSecureStorage',
                resetOnError: false,
              ),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            ),
        _localAuth = localAuth ?? LocalAuthentication();

  final FlutterSecureStorage _secure;
  final LocalAuthentication _localAuth;
  WalletEngine? _engine;

  static const _kMnemonic = 'auvora_mnemonic_v1';
  static const _kPinHash = 'auvora_pin_hash_v1';
  static const _kPinSalt = 'auvora_pin_salt_v1';
  static const _kBio = 'auvora_biometrics_v1';
  static const _kOnboarded = 'auvora_onboarded_v1';
  static const _kAddress = 'auvora_address_v1';

  AppStage stage = AppStage.splash;
  String? draftMnemonic;
  String? address;
  WalletVaultRecord? wallet;
  bool draftBackupConfirmed = false;
  bool hasPin = false;
  bool biometricsEnabled = false;
  bool onboardingComplete = false;
  bool reduceMotion = false;
  bool unlocked = false;
  String? errorMessage;
  bool busy = false;
  bool restoreResolved = false;
  bool _bootstrapInFlight = false;
  int _bootstrapAttempts = 0;
  Completer<void>? _engineReady;

  /// While true, [AppShell] must not auto-lock on pause (biometric / transfer auth
  /// overlays pause the activity and would otherwise wipe the signing session).
  bool suppressAutoLock = false;

  /// Local vault/PIN/address exists on this device — not a new-user Welcome.
  bool get hasLocalWallet =>
      wallet != null || (address != null && address!.isNotEmpty) || hasPin;

  void attachEngine(WalletEngine engine) {
    if (identical(_engine, engine)) return;
    _engine = engine;
    _engine?.setSessionUnlocked(unlocked);
    final ready = _engineReady;
    if (ready != null && !ready.isCompleted) ready.complete();
    if (!restoreResolved && (stage == AppStage.splash || stage == AppStage.welcome)) {
      // ignore: discarded_futures
      bootstrap();
    }
  }

  /// Re-run restore after the device unlocks or Keystore becomes readable.
  /// A first pass that ran while locked can look empty and must not stick on Welcome.
  Future<void> retryRestoreIfNeeded() async {
    if (stage == AppStage.dashboard || stage == AppStage.unlock || stage == AppStage.securityPin) {
      return;
    }
    if (hasLocalWallet && (stage == AppStage.welcome || stage == AppStage.walletChoice)) {
      resumeExistingSession();
      return;
    }
    if (stage != AppStage.welcome && stage != AppStage.splash) {
      return;
    }
    restoreResolved = false;
    _bootstrapAttempts = 0;
    await bootstrap();
  }

  /// Existing vault after account sign-in — unlock, never start a second wallet.
  void resumeExistingSession() {
    if (!hasLocalWallet) return;
    errorMessage = null;
    unlocked = false;
    stage = hasPin ? AppStage.unlock : AppStage.securityPin;
    notifyListeners();
  }

  String? addressFor(AssetNetwork network) {
    final value = wallet?.primaryAddress(chain: ChainIdMeta.fromAssetNetwork(network));
    return value ?? address;
  }

  /// Receive / Send network chips — catalog order, never drops testnet lanes.
  List<AssetNetwork> get availableNetworks {
    final fromWallet = wallet?.supportedChains.map((c) => c.assetNetwork).toSet() ??
        <AssetNetwork>{};
    if (fromWallet.isEmpty) {
      return List<AssetNetwork>.unmodifiable(NetworkCatalog.receiveNetworks);
    }
    return [
      for (final n in NetworkCatalog.receiveNetworks)
        if (fromWallet.contains(n)) n,
    ];
  }

  /// 1-based step within create/import onboarding (for progress UI).
  int get onboardingStep {
    switch (stage) {
      case AppStage.createExplain:
      case AppStage.importPhrase:
      case AppStage.walletChoice:
        return 1;
      case AppStage.createBackup:
        return 2;
      case AppStage.createVerify:
        return 3;
      case AppStage.securityPin:
        return 4;
      case AppStage.securityBiometric:
        return 5;
      case AppStage.permissions:
        return 6;
      default:
        return 0;
    }
  }

  int get onboardingStepCount => 6;

  /// Milliseconds from bootstrap start until first interactive stage (diagnostics).
  int? coldStartMs;

  Future<void> bootstrap({bool systemReduceMotion = false}) async {
    if (_bootstrapInFlight) return;
    _bootstrapInFlight = true;
    final started = DateTime.now();
    try {
      await _waitForEngine(const Duration(milliseconds: 300));
      await _bootstrapBody(systemReduceMotion: systemReduceMotion)
          .timeout(const Duration(seconds: 25));
      restoreResolved = _engine != null || stage != AppStage.welcome;
    } catch (_) {
      _applyTimeoutFallback();
      coldStartMs ??= DateTime.now().difference(started).inMilliseconds;
      notifyListeners();
      if (stage == AppStage.splash && _bootstrapAttempts < 1) {
        _bootstrapAttempts += 1;
        _bootstrapInFlight = false;
        await bootstrap(systemReduceMotion: systemReduceMotion);
        return;
      }
    } finally {
      _bootstrapInFlight = false;
    }
  }

  Future<void> _waitForEngine(Duration maxWait) async {
    if (_engine != null) return;
    _engineReady ??= Completer<void>();
    try {
      await _engineReady!.future.timeout(maxWait);
    } on TimeoutException {
      // Splash still proceeds with secure-storage + prefs evidence.
    }
  }

  void _applyTimeoutFallback() {
    if (stage != AppStage.splash) return;
    final target = WalletSessionRestore.decide(
      hasVault: wallet != null,
      hasAddress: address != null && address!.isNotEmpty,
      hasPin: hasPin,
      onboardingFlag: onboardingComplete,
      timedOut: true,
      bootstrapCompleted: false,
    );
    switch (target) {
      case WalletRestoreTarget.unlock:
        unlocked = false;
        stage = AppStage.unlock;
        restoreResolved = true;
        errorMessage = 'Still unlocking this device. Your keys stay on device.';
      case WalletRestoreTarget.securityPin:
        unlocked = false;
        stage = AppStage.securityPin;
        restoreResolved = true;
      case WalletRestoreTarget.welcome:
        if (_bootstrapAttempts >= 1) {
          stage = AppStage.welcome;
          restoreResolved = _engine != null;
          errorMessage =
              'Couldn’t finish wallet restore quickly. You can continue — your keys stay on device.';
        }
      case WalletRestoreTarget.splash:
        break;
    }
  }

  Future<void> _bootstrapBody({required bool systemReduceMotion}) async {
    final started = DateTime.now();
    final engine = _engine;
    // SharedPreferences and vault restore are independent — overlap them.
    final prefsFuture = SharedPreferences.getInstance();
    final engineBoot = engine?.bootstrap();
    final prefs = await prefsFuture;
    onboardingComplete = prefs.getBool(_kOnboarded) ?? false;
    if (engineBoot != null) {
      await engineBoot;
      wallet = engine!.wallet;
    }
    if (wallet == null) {
      final legacyMnemonic = await _secure.read(key: _kMnemonic);
      if (legacyMnemonic != null && engine != null) {
        wallet = await engine.importWallet(legacyMnemonic);
        await _secure.delete(key: _kMnemonic);
      }
    }
    // PIN / bio / legacy address flags are independent secure reads — overlap them.
    final primary = wallet?.primaryAddress();
    if (primary != null && primary.isNotEmpty) {
      address = primary;
      final flags = await Future.wait([
        _secure.read(key: _kPinHash),
        _secure.read(key: _kBio),
      ]);
      hasPin = flags[0] != null;
      biometricsEnabled = flags[1] == '1';
    } else {
      final flags = await Future.wait([
        _secure.read(key: _kAddress),
        _secure.read(key: _kPinHash),
        _secure.read(key: _kBio),
      ]);
      address = flags[0];
      hasPin = flags[1] != null;
      biometricsEnabled = flags[2] == '1';
    }
    reduceMotion = systemReduceMotion || (prefs.getBool('auvora_reduce_motion') ?? false);

    // Minimal paint settle only — no cosmetic half-second splash tax.
    if (!reduceMotion) {
      await Future<void>.delayed(const Duration(milliseconds: 80));
    }

    coldStartMs = DateTime.now().difference(started).inMilliseconds;
    StartupTiming.mark('walletRestoreDone');

    final hasAddress = address != null && address!.isNotEmpty;
    final hasVault = wallet != null;
    if (WalletSessionRestore.shouldHealOnboarded(
      hasVault: hasVault,
      hasAddress: hasAddress,
      hasPin: hasPin,
    )) {
      if (!onboardingComplete) {
        onboardingComplete = true;
        await prefs.setBool(_kOnboarded, true);
      }
    }

    final target = WalletSessionRestore.decide(
      hasVault: hasVault,
      hasAddress: hasAddress,
      hasPin: hasPin,
      onboardingFlag: onboardingComplete,
      timedOut: false,
      bootstrapCompleted: true,
    );
    switch (target) {
      case WalletRestoreTarget.unlock:
        unlocked = false;
        stage = AppStage.unlock;
      case WalletRestoreTarget.securityPin:
        unlocked = false;
        stage = AppStage.securityPin;
        errorMessage = 'Set a 6-digit passcode to protect this wallet.';
      case WalletRestoreTarget.welcome:
        stage = AppStage.welcome;
      case WalletRestoreTarget.splash:
        break;
    }
    _engine?.setSessionUnlocked(unlocked);
    notifyListeners();
  }

  void setReduceMotion(bool value) {
    if (reduceMotion == value) return;
    reduceMotion = value;
    SharedPreferences.getInstance().then((prefs) {
      prefs.setBool('auvora_reduce_motion', value);
    });
    notifyListeners();
  }

  static const _weakPins = {
    '000000',
    '111111',
    '123456',
    '654321',
    '121212',
    '112233',
  };

  bool isWeakPin(String pin) => _weakPins.contains(pin);

  int _pinFailures = 0;
  DateTime? _pinLockUntil;

  bool get pinTemporarilyLocked {
    final until = _pinLockUntil;
    if (until == null) return false;
    if (DateTime.now().isAfter(until)) {
      _pinLockUntil = null;
      return false;
    }
    return true;
  }

  Duration? get pinLockRemaining {
    final until = _pinLockUntil;
    if (until == null) return null;
    final left = until.difference(DateTime.now());
    return left.isNegative ? null : left;
  }

  void backToExplain() {
    stage = AppStage.createExplain;
    errorMessage = null;
    notifyListeners();
  }

  void goWelcome() {
    stage = AppStage.welcome;
    draftMnemonic = null;
    draftBackupConfirmed = false;
    errorMessage = null;
    notifyListeners();
  }

  void goWalletChoice() {
    draftMnemonic = null;
    draftBackupConfirmed = false;
    stage = AppStage.walletChoice;
    errorMessage = null;
    notifyListeners();
  }

  /// Explain first — generate only when the user continues.
  void startCreate() {
    draftMnemonic = null;
    draftBackupConfirmed = false;
    stage = AppStage.createExplain;
    errorMessage = null;
    notifyListeners();
  }

  void generateAndShowBackup() {
    // Never regenerate a phrase the user may already have written down.
    draftMnemonic ??= WalletCrypto.generateMnemonic();
    stage = AppStage.createBackup;
    errorMessage = null;
    notifyListeners();
  }

  void continueToBackup() {
    draftMnemonic ??= WalletCrypto.generateMnemonic();
    stage = AppStage.createBackup;
    notifyListeners();
  }

  void continueToVerify() {
    final phrase = draftMnemonic ?? '';
    if (!draftBackupConfirmed || !WalletCrypto.validateMnemonic(phrase)) {
      errorMessage = !draftBackupConfirmed
          ? 'Confirm you wrote the phrase down before continuing.'
          : WalletCrypto.issueMessage(WalletCrypto.diagnoseMnemonic(phrase));
      notifyListeners();
      return;
    }
    stage = AppStage.createVerify;
    errorMessage = null;
    notifyListeners();
  }

  void startImport() {
    draftMnemonic = null;
    draftBackupConfirmed = false;
    stage = AppStage.importPhrase;
    errorMessage = null;
    notifyListeners();
  }

  Future<void> commitMnemonic(String mnemonic, {bool backupQuizPassed = false}) async {
    final engine = _engine;
    if (stage == AppStage.createVerify && !backupQuizPassed) {
      errorMessage = 'Confirm each recovery word before continuing.';
      notifyListeners();
      return;
    }
    final normalized = WalletCrypto.normalizeMnemonic(mnemonic);
    final issue = WalletCrypto.diagnoseMnemonic(normalized);
    if (issue != MnemonicIssue.none) {
      errorMessage = WalletCrypto.issueMessage(issue);
      notifyListeners();
      return;
    }
    busy = true;
    errorMessage = null;
    notifyListeners();
    try {
      if (engine != null) {
        wallet = await engine.importWallet(normalized, backupConfirmed: draftBackupConfirmed);
        address = wallet?.primaryAddress();
        // Keep signing session locked until passcode is set.
        engine.setSessionUnlocked(false);
      } else {
        final addr = WalletCrypto.fingerprintAddress(normalized);
        await _secure.write(key: _kMnemonic, value: normalized);
        await _secure.write(key: _kAddress, value: addr);
        address = addr;
      }
      draftMnemonic = null;
      draftBackupConfirmed = false;
      stage = AppStage.securityPin;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> setPin(String pin) async {
    if (pin.length != 6 || !RegExp(r'^\d{6}$').hasMatch(pin)) {
      errorMessage = 'Use a 6-digit passcode.';
      notifyListeners();
      return;
    }
    if (isWeakPin(pin)) {
      errorMessage = 'Choose a less obvious passcode.';
      notifyListeners();
      return;
    }
    final salt = WalletCrypto.newSalt();
    final hash = WalletCrypto.pinPepperHash(pin, salt);
    await _secure.write(key: _kPinSalt, value: salt);
    await _secure.write(key: _kPinHash, value: hash);
    hasPin = true;
    errorMessage = null;
    stage = AppStage.securityBiometric;
    notifyListeners();
  }

  Future<bool> verifyPin(String pin) async {
    if (pinTemporarilyLocked) return false;
    final salt = await _secure.read(key: _kPinSalt);
    final hash = await _secure.read(key: _kPinHash);
    if (salt == null || hash == null) return false;
    final ok = WalletCrypto.verifyPinHash(pin, salt, hash);
    if (ok) {
      _pinFailures = 0;
      _pinLockUntil = null;
      return true;
    }
    _pinFailures += 1;
    if (_pinFailures >= 5) {
      final seconds = (30 * (_pinFailures - 4)).clamp(30, 300);
      _pinLockUntil = DateTime.now().add(Duration(seconds: seconds));
    }
    return false;
  }

  Future<void> unlockWithPin(String pin) async {
    busy = true;
    errorMessage = null;
    notifyListeners();
    try {
      if (pinTemporarilyLocked) {
        final secs = pinLockRemaining?.inSeconds ?? 30;
        errorMessage = 'Too many attempts. Try again in $secs seconds.';
        return;
      }
      final ok = await verifyPin(pin);
      if (!ok) {
        if (pinTemporarilyLocked) {
          final secs = pinLockRemaining?.inSeconds ?? 30;
          errorMessage = 'Too many attempts. Try again in $secs seconds.';
        } else {
          errorMessage = 'Incorrect passcode. Try again.';
        }
        return;
      }
      unlocked = true;
      stage = AppStage.dashboard;
      _engine?.setSessionUnlocked(true);
      await _afterUnlock();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> unlockWithBiometrics() async {
    if (!biometricsEnabled) return;
    busy = true;
    errorMessage = null;
    notifyListeners();
    try {
      final available = await canCheckBiometrics();
      if (!available) {
        errorMessage =
            'Biometrics aren’t enrolled on this device anymore. Use your passcode, or re-enable biometrics in Security after adding a fingerprint or face unlock.';
        return;
      }
      final ok = await _localAuth.authenticate(
        localizedReason: 'Unlock Auvora',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
      if (!ok) {
        errorMessage = 'Biometrics weren’t confirmed. Use your passcode.';
        return;
      }
      unlocked = true;
      errorMessage = null;
      stage = AppStage.dashboard;
      _engine?.setSessionUnlocked(true);
      await _afterUnlock();
    } on PlatformException catch (e) {
      errorMessage = _biometricErrorMessage(e);
    } catch (_) {
      errorMessage = 'Biometrics unavailable. Use your passcode.';
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> _afterUnlock() async {
    final engine = _engine;
    if (engine == null) return;
    wallet = await engine.rebuildAddressesIfNeeded() ?? engine.wallet;
    address = wallet?.primaryAddress() ?? address;
    if (address != null) {
      await _secure.write(key: _kAddress, value: address!);
    }
  }

  /// Build plaintext vault entries for cloud encryption (mnemonics stay on-device
  /// until encrypted client-side).
  Future<List<VaultWalletEntry>> buildVaultPlaintextEntries() async {
    final engine = _engine;
    if (engine == null || !unlocked) return const [];
    final entries = <VaultWalletEntry>[];
    for (final v in engine.vaults) {
      final mnemonic = await engine.keyStore.readMnemonic(walletId: v.walletId);
      if (mnemonic == null || mnemonic.isEmpty) continue;
      entries.add(
        VaultWalletEntry(
          walletId: v.walletId,
          mnemonic: mnemonic,
          label: v.name,
          metadata: {
            'backupConfirmed': v.backupConfirmed,
            'createdAt': v.createdAt.toIso8601String(),
          },
        ),
      );
    }
    return entries;
  }

  /// Import wallets from a decrypted cloud vault bundle onto this device.
  Future<int> importEncryptedVaultBundle(VaultPlaintextBundle bundle) async {
    final engine = _engine;
    if (engine == null) return 0;
    var imported = 0;
    for (final entry in bundle.wallets) {
      final phrase = entry.mnemonic.trim();
      if (phrase.isEmpty) continue;
      final issue = WalletCrypto.diagnoseMnemonic(phrase);
      if (issue != MnemonicIssue.none) continue;
      await engine.importWallet(
        phrase,
        backupConfirmed: entry.metadata?['backupConfirmed'] == true,
        name: (entry.label?.trim().isNotEmpty ?? false) ? entry.label!.trim() : 'Restored wallet',
      );
      imported += 1;
    }
    await engine.bootstrap();
    wallet = engine.wallet;
    address = wallet?.primaryAddress();
    if (address != null) await _secure.write(key: _kAddress, value: address!);
    engine.setSessionUnlocked(false);
    unlocked = false;
    if (imported > 0) {
      if (hasPin) {
        stage = AppStage.unlock;
      } else {
        stage = AppStage.securityPin;
      }
    }
    notifyListeners();
    return imported;
  }

  List<VaultIndexEntry> get vaults => _engine?.vaults ?? const [];

  bool get needsBackupReminder => _engine?.needsBackupReminder ?? false;

  Future<bool> switchWallet(String walletId) async {
    final engine = _engine;
    if (engine == null || !unlocked) return false;
    final ok = await engine.switchWallet(walletId);
    if (!ok) return false;
    wallet = await engine.rebuildAddressesIfNeeded() ?? engine.wallet;
    address = wallet?.primaryAddress();
    if (address != null) await _secure.write(key: _kAddress, value: address!);
    notifyListeners();
    return true;
  }

  Future<void> renameWallet(String walletId, String name) async {
    final engine = _engine;
    if (engine == null || !unlocked) return;
    await engine.renameWallet(walletId, name);
    wallet = engine.wallet;
    notifyListeners();
  }

  Future<bool> deleteWallet(String walletId) async {
    final engine = _engine;
    if (engine == null || !unlocked) return false;
    final ok = await engine.deleteWallet(walletId);
    if (!ok) return false;
    wallet = engine.wallet;
    address = wallet?.primaryAddress();
    if (address != null) await _secure.write(key: _kAddress, value: address!);
    notifyListeners();
    return true;
  }

  Future<WalletVaultRecord?> createAdditionalWallet({
    required String mnemonic,
    String? name,
    required bool backupQuizPassed,
  }) async {
    if (!backupQuizPassed) {
      errorMessage = 'Confirm each recovery word before continuing.';
      notifyListeners();
      return null;
    }
    final engine = _engine;
    if (engine == null || !unlocked) return null;
    final created = await engine.createWallet(
      mnemonic: mnemonic,
      name: name,
      backupConfirmed: true,
    );
    wallet = created;
    address = created.primaryAddress();
    if (address != null) await _secure.write(key: _kAddress, value: address!);
    notifyListeners();
    return created;
  }

  Future<bool> canCheckBiometrics() async {
    try {
      final supported = await _localAuth.isDeviceSupported();
      if (!supported) return false;
      final canCheck = await _localAuth.canCheckBiometrics;
      if (!canCheck) return false;
      final enrolled = await _localAuth.getAvailableBiometrics();
      return enrolled.isNotEmpty;
    } catch (_) {
      return false;
    }
  }

  Future<void> enableBiometrics(bool enabled) async {
    if (enabled) {
      try {
        final available = await canCheckBiometrics();
        if (!available) {
          errorMessage =
              'No enrolled biometrics found. Add a fingerprint or face unlock in system settings, then try again.';
          notifyListeners();
          return;
        }
        final ok = await _localAuth.authenticate(
          localizedReason: 'Use biometrics to unlock Auvora on this device',
          options: const AuthenticationOptions(
            biometricOnly: true,
            stickyAuth: true,
            useErrorDialogs: true,
          ),
        );
        if (!ok) {
          errorMessage = 'Biometrics weren’t confirmed. You can turn them on later.';
          notifyListeners();
          return;
        }
      } on PlatformException catch (e) {
        errorMessage = _biometricErrorMessage(e, enabling: true);
        notifyListeners();
        return;
      } catch (_) {
        errorMessage = 'Biometrics unavailable right now. Continue with passcode — you can enable later.';
        notifyListeners();
        return;
      }
      await _secure.write(key: _kBio, value: '1');
      biometricsEnabled = true;
    } else {
      await _secure.write(key: _kBio, value: '0');
      biometricsEnabled = false;
    }
    errorMessage = null;
    // Only advance onboarding when still on the biometric setup stage.
    if (stage == AppStage.securityBiometric) {
      stage = AppStage.permissions;
    }
    notifyListeners();
  }

  String _biometricErrorMessage(PlatformException e, {bool enabling = false}) {
    final code = e.code;
    if (code == auth_error.notAvailable || code == auth_error.notEnrolled) {
      return enabling
          ? 'Biometrics aren’t set up on this device. Continue with passcode — you can enable later.'
          : 'Biometrics aren’t available. Use your passcode.';
    }
    if (code == auth_error.lockedOut || code == auth_error.permanentlyLockedOut) {
      return 'Biometrics locked after too many attempts. Use your passcode.';
    }
    if (code == auth_error.passcodeNotSet) {
      return 'Set a device screen lock in system settings before using biometrics.';
    }
    return enabling
        ? 'Biometrics couldn’t be confirmed. Continue with passcode — you can enable later.'
        : 'Biometrics unavailable. Use your passcode.';
  }

  Future<void> finishPermissions() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_kOnboarded, true);
    onboardingComplete = true;
    unlocked = true;
    stage = AppStage.dashboard;
    _engine?.setSessionUnlocked(true);
    notifyListeners();
  }

  void setDraftBackupConfirmed(bool value) {
    if (draftBackupConfirmed == value) return;
    draftBackupConfirmed = value;
    notifyListeners();
  }

  Future<void> markBackupConfirmed({bool verified = false}) async {
    final engine = _engine;
    if (engine == null) return;
    wallet = await engine.updateSecurityMetadata(
      backupConfirmed: true,
      phraseVerifiedAt: verified ? DateTime.now() : wallet?.phraseVerifiedAt,
    );
    notifyListeners();
  }

  Future<void> markSecurityReviewNow() async {
    final engine = _engine;
    if (engine == null) return;
    wallet = await engine.updateSecurityMetadata(
      lastSecurityReviewAt: DateTime.now(),
    );
    notifyListeners();
  }

  Future<String?> revealRecoveryPhrase() async {
    return _engine?.mnemonic();
  }

  Future<bool> changePin({
    required String currentPin,
    required String nextPin,
  }) async {
    if (!await verifyPin(currentPin)) return false;
    if (nextPin.length != 6 || !RegExp(r'^\d{6}$').hasMatch(nextPin)) return false;
    if (isWeakPin(nextPin)) return false;
    final salt = WalletCrypto.newSalt();
    final hash = WalletCrypto.pinPepperHash(nextPin, salt);
    await _secure.write(key: _kPinSalt, value: salt);
    await _secure.write(key: _kPinHash, value: hash);
    hasPin = true;
    notifyListeners();
    return true;
  }

  Future<bool> authenticateForTransfer({String reason = 'Confirm this transfer'}) async {
    if (!biometricsEnabled) return false;
    suppressAutoLock = true;
    try {
      final available = await canCheckBiometrics();
      if (!available) return false;
      final ok = await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
      if (ok) {
        // Biometric prompt pauses the Activity; restore signing session that
        // auto-lock would otherwise clear mid-transfer.
        unlockSessionForTransfer();
      }
      return ok;
    } on PlatformException {
      // Caller falls through to PIN when biometrics fail/cancel/unavailable.
      return false;
    } catch (_) {
      return false;
    } finally {
      suppressAutoLock = false;
    }
  }

  /// Re-open the on-device signing session after transfer biometric/PIN success.
  /// Does not reveal keys off-device; only allows [WalletEngine.mnemonic] locally.
  void unlockSessionForTransfer() {
    unlocked = true;
    if (stage == AppStage.unlock) {
      stage = AppStage.dashboard;
    }
    _engine?.setSessionUnlocked(true);
    notifyListeners();
  }

  Future<void> lock() async {
    if (!hasPin) return;
    if (suppressAutoLock) return;
    unlocked = false;
    stage = AppStage.unlock;
    errorMessage = null;
    _engine?.setSessionUnlocked(false);
    notifyListeners();
  }

  Future<void> wipeLocalWallet() async {
    await _engine?.wipe();
    await _secure.deleteAll();
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
    address = null;
    wallet = null;
    hasPin = false;
    biometricsEnabled = false;
    onboardingComplete = false;
    unlocked = false;
    draftMnemonic = null;
    stage = AppStage.welcome;
    notifyListeners();
  }
}
