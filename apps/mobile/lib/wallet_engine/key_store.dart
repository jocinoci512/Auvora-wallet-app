import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

class SecureKeyStore {
  SecureKeyStore({FlutterSecureStorage? secureStorage})
      : _secure = secureStorage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _secure;

  static const mnemonicKey = 'auvora_mnemonic_v2';
  static const walletKey = 'auvora_wallet_v2';

  Future<void> saveWallet({
    required String mnemonic,
    required WalletVaultRecord wallet,
  }) async {
    // Platform secure storage already encrypts values at rest using the OS
    // keystore / keychain boundary. Avoid layering custom reversible crypto
    // with app-bundled secrets on top of it.
    await _secure.write(key: mnemonicKey, value: mnemonic);
    await _secure.write(key: walletKey, value: wallet.encode());
  }

  Future<String?> readMnemonic() async {
    return _secure.read(key: mnemonicKey);
  }

  Future<WalletVaultRecord?> readWallet() async {
    final raw = await _secure.read(key: walletKey);
    if (raw == null || raw.isEmpty) return null;
    return WalletVaultRecord.decode(raw);
  }

  Future<void> clearWalletEngineState() async {
    await _secure.delete(key: mnemonicKey);
    await _secure.delete(key: walletKey);
  }
}
