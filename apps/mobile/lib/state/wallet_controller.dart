import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../crypto/wallet_crypto.dart';
import '../portfolio/models.dart';
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

  Future<void> bootstrap({bool systemReduceMotion = false}) async {
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
      }
    }
    address = wallet?.primaryAddress() ?? await _secure.read(key: _kAddress);
    hasPin = (await _secure.read(key: _kPinHash)) != null;
    biometricsEnabled = (await _secure.read(key: _kBio)) == '1';
    reduceMotion = systemReduceMotion || (prefs.getBool('auvora_reduce_motion') ?? false);

    // Keep splash brief — premium feels fast.
    await Future<void>.delayed(Duration(milliseconds: reduceMotion ? 200 : 480));

    if (onboardingComplete && address != null && hasPin) {
      unlocked = false;
      stage = AppStage.unlock;
    } else if (onboardingComplete && address != null) {
      unlocked = true;
      stage = AppStage.dashboard;
    } else {
      stage = AppStage.welcome;
    }
    _engine?.setSessionUnlocked(unlocked);
    notifyListeners();
  }

  void setReduceMotion(bool value) {
    if (reduceMotion == value) return;
    reduceMotion = value;
    notifyListeners();
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
        engine.setSessionUnlocked(true);
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
    final salt = await _secure.read(key: _kPinSalt);
    final hash = await _secure.read(key: _kPinHash);
    if (salt == null || hash == null) return false;
    return WalletCrypto.pinPepperHash(pin, salt) == hash;
  }

  Future<void> unlockWithPin(String pin) async {
    busy = true;
    errorMessage = null;
    notifyListeners();
    try {
      final ok = await verifyPin(pin);
      if (!ok) {
        errorMessage = 'Incorrect passcode. Try again.';
        return;
      }
      unlocked = true;
      stage = AppStage.dashboard;
      _engine?.setSessionUnlocked(true);
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<void> unlockWithBiometrics() async {
    if (!biometricsEnabled) return;
    try {
      final ok = await _localAuth.authenticate(
        localizedReason: 'Unlock Auvora',
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
      if (!ok) {
        errorMessage = 'Biometrics weren’t confirmed. Use your passcode.';
        notifyListeners();
        return;
      }
      unlocked = true;
      errorMessage = null;
      stage = AppStage.dashboard;
      _engine?.setSessionUnlocked(true);
      notifyListeners();
    } catch (_) {
      errorMessage = 'Biometrics unavailable. Use your passcode.';
      notifyListeners();
    }
  }

  Future<bool> canCheckBiometrics() async {
    try {
      return await _localAuth.canCheckBiometrics || await _localAuth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  Future<void> enableBiometrics(bool enabled) async {
    if (enabled) {
      final ok = await _localAuth.authenticate(
        localizedReason: 'Use biometrics to unlock Auvora on this device',
        options: const AuthenticationOptions(biometricOnly: true, stickyAuth: true),
      );
      if (!ok) {
        errorMessage = 'Biometrics weren’t confirmed. You can turn them on later.';
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
    stage = AppStage.permissions;
    notifyListeners();
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
    if (nextPin.length != 6 || !RegExp(r'^\\d{6}\$').hasMatch(nextPin)) return false;
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
      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(biometricOnly: false, stickyAuth: true),
      );
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
