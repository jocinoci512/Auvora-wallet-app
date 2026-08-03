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
  List<VaultIndexEntry> _vaults = const [];
  KeyMaterialState _keyState = KeyMaterialState.missing;
  bool _sessionUnlocked = false;

  WalletVaultRecord? get wallet => _wallet;
  List<VaultIndexEntry> get vaults => _vaults;
  KeyMaterialState get keyState => _keyState;
  bool get sessionUnlocked => _sessionUnlocked;

  Future<void> bootstrap() async {
    // One migration pass, then parallel vault/wallet/mnemonic reads (I/O bound).
    await _keyStore.ensureReady();
    final results = await Future.wait<Object?>([
      _keyStore.listVaults(),
      _keyStore.readWallet(),
      _keyStore.readMnemonic(),
    ]);
    _vaults = results[0]! as List<VaultIndexEntry>;
    _wallet = results[1] as WalletVaultRecord?;
    final mnemonic = results[2] as String?;
    _keyState = mnemonic == null ? KeyMaterialState.missing : KeyMaterialState.locked;
    _sessionUnlocked = false;
  }

  Future<WalletVaultRecord> createWallet({
    required String mnemonic,
    bool backupConfirmed = false,
    String? name,
  }) async {
    final wallet = _buildWallet(
      mnemonic,
      backupConfirmed: backupConfirmed,
      name: name ?? (_vaults.isEmpty ? 'Primary wallet' : 'Wallet ${_vaults.length + 1}'),
    );
    await _keyStore.saveWallet(mnemonic: mnemonic, wallet: wallet);
    await _keyStore.setActiveWalletId(wallet.walletId);
    _wallet = wallet;
    _vaults = await _keyStore.listVaults();
    _keyState = KeyMaterialState.unlocked;
    _sessionUnlocked = true;
    return wallet;
  }

  Future<WalletVaultRecord> importWallet(
    String mnemonic, {
    bool backupConfirmed = false,
    String? name,
  }) async {
    return createWallet(mnemonic: mnemonic, backupConfirmed: backupConfirmed, name: name);
  }

  Future<bool> switchWallet(String walletId) async {
    if (!_sessionUnlocked) return false;
    final next = await _keyStore.readWallet(walletId: walletId);
    if (next == null) return false;
    await _keyStore.setActiveWalletId(walletId);
    _wallet = next;
    _vaults = await _keyStore.listVaults();
    return true;
  }

  Future<void> renameWallet(String walletId, String name) async {
    if (!_sessionUnlocked) return;
    await _keyStore.renameVault(walletId: walletId, name: name);
    _vaults = await _keyStore.listVaults();
    if (_wallet?.walletId == walletId) {
      _wallet = await _keyStore.readWallet(walletId: walletId);
    }
  }

  /// Deletes a non-active or secondary vault. Refuses to delete the last vault.
  Future<bool> deleteWallet(String walletId) async {
    if (!_sessionUnlocked) return false;
    final ok = await _keyStore.deleteVault(walletId);
    if (!ok) return false;
    _vaults = await _keyStore.listVaults();
    _wallet = await _keyStore.readWallet();
    return true;
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
    _vaults = const [];
    _keyState = KeyMaterialState.missing;
    _sessionUnlocked = false;
  }

  Future<WalletVaultRecord?> updateSecurityMetadata({
    bool? backupConfirmed,
    DateTime? phraseVerifiedAt,
    DateTime? lastSecurityReviewAt,
  }) async {
    final current = _wallet;
    if (!_sessionUnlocked) return current;
    final phrase = await _keyStore.readMnemonic();
    if (current == null || phrase == null) return current;
    final next = current.copyWith(
      backupConfirmed: backupConfirmed,
      phraseVerifiedAt: phraseVerifiedAt,
      lastSecurityReviewAt: lastSecurityReviewAt,
    );
    await _keyStore.saveWallet(mnemonic: phrase, wallet: next);
    _wallet = next;
    _vaults = await _keyStore.listVaults();
    return next;
  }

  Future<WalletVaultRecord?> rebuildAddressesIfNeeded() async {
    final current = _wallet;
    if (!_sessionUnlocked || current == null) return current;
    final phrase = await _keyStore.readMnemonic();
    if (phrase == null) return current;
    final rebuilt = _buildWallet(
      phrase,
      backupConfirmed: current.backupConfirmed,
      name: current.name,
    ).copyWith(
      phraseVerifiedAt: current.phraseVerifiedAt,
      lastSecurityReviewAt: current.lastSecurityReviewAt,
    );
    // Preserve walletId so vault index stays stable.
    final next = WalletVaultRecord(
      walletId: current.walletId,
      name: current.name,
      accounts: rebuilt.accounts,
      createdAt: current.createdAt,
      supportedChains: rebuilt.supportedChains,
      activeAccountId: rebuilt.activeAccountId,
      backupConfirmed: current.backupConfirmed,
      phraseVerifiedAt: current.phraseVerifiedAt,
      lastSecurityReviewAt: current.lastSecurityReviewAt,
    );
    await _keyStore.saveWallet(mnemonic: phrase, wallet: next);
    _wallet = next;
    return next;
  }

  String? addressForNetwork(AssetNetwork network) {
    final wallet = _wallet;
    if (wallet == null) return null;
    return wallet.primaryAddress(chain: ChainIdMeta.fromAssetNetwork(network));
  }

  /// Reminds when backup is still unconfirmed after creation.
  bool get needsBackupReminder {
    final wallet = _wallet;
    if (wallet == null) return false;
    if (wallet.backupConfirmed) return false;
    return DateTime.now().difference(wallet.createdAt) > const Duration(hours: 1);
  }

  WalletVaultRecord _buildWallet(
    String mnemonic, {
    required bool backupConfirmed,
    required String name,
  }) {
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
      name: name,
      accounts: [account],
      createdAt: DateTime.now(),
      supportedChains: chains,
      activeAccountId: account.id,
      backupConfirmed: backupConfirmed,
    );
  }
}
