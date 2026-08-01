import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/error_codes.dart' as auth_error;
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../crypto/wallet_crypto.dart';
import '../portfolio/models.dart';
import '../wallet_engine/key_store.dart';
import '../wallet_engine/models.dart';
import '../wallet_engine/wallet_engine.dart';

enum AppStage {
  splash,
  unlock,
  welcome,
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
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
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

  void attachEngine(WalletEngine engine) {
    if (identical(_engine, engine)) return;
    _engine = engine;
    _engine?.setSessionUnlocked(unlocked);
  }

  String? addressFor(AssetNetwork network) {
    final value = wallet?.primaryAddress(chain: ChainIdMeta.fromAssetNetwork(network));
    return value ?? address;
  }

  List<AssetNetwork> get availableNetworks =>
      wallet?.supportedChains.map((chain) => chain.assetNetwork).toList(growable: false) ??
      const [AssetNetwork.ethereum];

  /// 1-based step within create/import onboarding (for progress UI).
  int get onboardingStep {
    switch (stage) {
      case AppStage.createExplain:
      case AppStage.importPhrase:
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
    final started = DateTime.now();
    final engine = _engine;
    final prefs = await SharedPreferences.getInstance();
    onboardingComplete = prefs.getBool(_kOnboarded) ?? false;
    if (engine != null) {
      await engine.bootstrap();
      wallet = engine.wallet;
    }
    if (wallet == null) {
      final legacyMnemonic = await _secure.read(key: _kMnemonic);
      if (legacyMnemonic != null && engine != null) {
        wallet = await engine.importWallet(legacyMnemonic);
        await _secure.delete(key: _kMnemonic);
      }
    }
    address = wallet?.primaryAddress() ?? await _secure.read(key: _kAddress);
    hasPin = (await _secure.read(key: _kPinHash)) != null;
    biometricsEnabled = (await _secure.read(key: _kBio)) == '1';
    reduceMotion = systemReduceMotion || (prefs.getBool('auvora_reduce_motion') ?? false);

    // Minimal paint settle only — no cosmetic half-second splash tax.
    if (!reduceMotion) {
      await Future<void>.delayed(const Duration(milliseconds: 80));
    }

    coldStartMs = DateTime.now().difference(started).inMilliseconds;

    if (onboardingComplete && address != null && hasPin) {
      unlocked = false;
      stage = AppStage.unlock;
    } else if (onboardingComplete && address != null && !hasPin) {
      // Never auto-unlock without a device passcode — Closed Beta gate.
      unlocked = false;
      stage = AppStage.securityPin;
      errorMessage = 'Set a 6-digit passcode to protect this wallet.';
    } else {
      stage = AppStage.welcome;
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

  /// Explain first — generate only when the user continues.
  void startCreate() {
    draftMnemonic = null;
    draftBackupConfirmed = false;
    stage = AppStage.createExplain;
    errorMessage = null;
    notifyListeners();
  }

  void generateAndShowBackup() {
    draftMnemonic = WalletCrypto.generateMnemonic();
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

  Future<void> commitMnemonic(String mnemonic) async {
    final engine = _engine;
    final normalized = WalletCrypto.normalizeMnemonic(mnemonic);
    final count = normalized.isEmpty ? 0 : normalized.split(' ').length;
    if (count != 12 && count != 24) {
      errorMessage = 'Use a 12- or 24-word recovery phrase.';
      notifyListeners();
      return;
    }
    if (!WalletCrypto.validateMnemonic(normalized)) {
      errorMessage = 'That phrase isn’t valid. Check each word carefully.';
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
        errorMessage = 'Biometrics aren’t available on this device. Use your passcode.';
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
  }) async {
    final engine = _engine;
    if (engine == null || !unlocked) return null;
    final created = await engine.createWallet(mnemonic: mnemonic, name: name, backupConfirmed: false);
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
    try {
      final available = await canCheckBiometrics();
      if (!available) return false;
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: false,
          stickyAuth: true,
          useErrorDialogs: true,
        ),
      );
    } on PlatformException {
      // Caller falls through to PIN when biometrics fail/cancel/unavailable.
      return false;
    } catch (_) {
      return false;
    }
  }

  Future<void> lock() async {
    if (!hasPin) return;
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
