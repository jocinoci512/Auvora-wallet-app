import 'package:uuid/uuid.dart';

import '../portfolio/models.dart';
import 'blockchain_adapter.dart';
import 'key_store.dart';
import 'models.dart';

class WalletEngine {
  WalletEngine({
    required SecureKeyStore keyStore,
    required BlockchainLayer blockchainLayer,
  })  : _keyStore = keyStore,
        _blockchainLayer = blockchainLayer;

  final SecureKeyStore _keyStore;
  final BlockchainLayer _blockchainLayer;
  static const _uuid = Uuid();

  WalletVaultRecord? _wallet;
  KeyMaterialState _keyState = KeyMaterialState.missing;
  bool _sessionUnlocked = false;

  WalletVaultRecord? get wallet => _wallet;
  KeyMaterialState get keyState => _keyState;
  bool get sessionUnlocked => _sessionUnlocked;

  Future<void> bootstrap() async {
    _wallet = await _keyStore.readWallet();
    final mnemonic = await _keyStore.readMnemonic();
    _keyState = mnemonic == null ? KeyMaterialState.missing : KeyMaterialState.locked;
    _sessionUnlocked = false;
  }

  Future<WalletVaultRecord> createWallet({
    required String mnemonic,
    bool backupConfirmed = false,
  }) async {
    final wallet = _buildWallet(mnemonic, backupConfirmed: backupConfirmed);
    await _keyStore.saveWallet(mnemonic: mnemonic, wallet: wallet);
    _wallet = wallet;
    _keyState = KeyMaterialState.unlocked;
    _sessionUnlocked = true;
    return wallet;
  }

  Future<WalletVaultRecord> importWallet(String mnemonic, {bool backupConfirmed = false}) async {
    return createWallet(mnemonic: mnemonic, backupConfirmed: backupConfirmed);
  }

  void setSessionUnlocked(bool value) {
    _sessionUnlocked = value;
    if (_keyState != KeyMaterialState.missing) {
      _keyState = value ? KeyMaterialState.unlocked : KeyMaterialState.locked;
    }
  }

  Future<String?> mnemonic() async {
    if (!_sessionUnlocked) return null;
    return _keyStore.readMnemonic();
  }

  Future<void> wipe() async {
    await _keyStore.clearWalletEngineState();
    _wallet = null;
    _keyState = KeyMaterialState.missing;
    _sessionUnlocked = false;
  }

  Future<WalletVaultRecord?> updateSecurityMetadata({
    bool? backupConfirmed,
    DateTime? phraseVerifiedAt,
    DateTime? lastSecurityReviewAt,
  }) async {
    final current = _wallet;
    final mnemonic = await _keyStore.readMnemonic();
    if (current == null || mnemonic == null) return current;
    final next = WalletVaultRecord(
      walletId: current.walletId,
      accounts: current.accounts,
      createdAt: current.createdAt,
      supportedChains: current.supportedChains,
      activeAccountId: current.activeAccountId,
      backupConfirmed: backupConfirmed ?? current.backupConfirmed,
      phraseVerifiedAt: phraseVerifiedAt ?? current.phraseVerifiedAt,
      lastSecurityReviewAt: lastSecurityReviewAt ?? current.lastSecurityReviewAt,
    );
    await _keyStore.saveWallet(mnemonic: mnemonic, wallet: next);
    _wallet = next;
    return next;
  }

  String? addressForNetwork(AssetNetwork network) {
    final wallet = _wallet;
    if (wallet == null) return null;
    return wallet.primaryAddress(chain: ChainIdMeta.fromAssetNetwork(network));
  }

  WalletVaultRecord _buildWallet(String mnemonic, {required bool backupConfirmed}) {
    final chains = _blockchainLayer.supportedChains.toList(growable: false);
    final account = WalletAccountRecord(
      id: 'main',
      name: 'Main account',
      index: 0,
      addresses: [
        for (final chain in chains)
          _blockchainLayer.adapterFor(chain).deriveAddress(mnemonic: mnemonic, accountIndex: 0),
      ],
      preferredChain: ChainId.ethereum,
    );
    return WalletVaultRecord(
      walletId: _uuid.v4(),
      accounts: [account],
      createdAt: DateTime.now(),
      supportedChains: chains,
      activeAccountId: account.id,
      backupConfirmed: backupConfirmed,
    );
  }
}
