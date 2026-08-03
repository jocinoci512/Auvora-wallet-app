import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

/// Encrypted-at-rest vault storage via OS keystore / keychain.
///
/// Supports multiple wallets. Legacy single-vault keys (`auvora_mnemonic_v2` /
/// `auvora_wallet_v2`) migrate into the indexed format on first read.
class SecureKeyStore {
  SecureKeyStore({FlutterSecureStorage? secureStorage})
      : _secure = secureStorage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );

  final FlutterSecureStorage _secure;

  static const _legacyMnemonicKey = 'auvora_mnemonic_v2';
  static const _legacyWalletKey = 'auvora_wallet_v2';
  static const _indexKey = 'auvora_vault_index_v1';
  static const _activeKey = 'auvora_vault_active_v1';

  /// Once migration has run successfully in this process, skip re-checking.
  bool _migrationDone = false;
  Future<void>? _migrationInFlight;

  List<VaultIndexEntry>? _indexCache;
  String? _activeIdCache;
  bool _activeIdLoaded = false;

  String _mnemonicKey(String walletId) => 'auvora_mnemonic_v3_$walletId';
  String _walletKey(String walletId) => 'auvora_wallet_v3_$walletId';

  /// Ensures legacy migration finished once — safe to call concurrently.
  Future<void> ensureReady() => _migrateLegacyIfNeeded();

  Future<List<VaultIndexEntry>> listVaults() async {
    await _migrateLegacyIfNeeded();
    if (_indexCache != null) return List.unmodifiable(_indexCache!);
    final raw = await _secure.read(key: _indexKey);
    if (raw == null || raw.isEmpty) {
      _indexCache = const [];
      return const [];
    }
    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      _indexCache = const [];
      return const [];
    }
    _indexCache = [
      for (final item in decoded)
        if (item is Map)
          VaultIndexEntry.fromJson(Map<String, Object?>.from(item)),
    ];
    return List.unmodifiable(_indexCache!);
  }

  Future<String?> activeWalletId() async {
    await _migrateLegacyIfNeeded();
    if (_activeIdLoaded) {
      if (_activeIdCache != null && _activeIdCache!.isNotEmpty) return _activeIdCache;
    } else {
      final id = await _secure.read(key: _activeKey);
      _activeIdLoaded = true;
      if (id != null && id.isNotEmpty) {
        _activeIdCache = id;
        return id;
      }
    }
    final vaults = await listVaults();
    return vaults.isEmpty ? null : vaults.first.walletId;
  }

  Future<void> setActiveWalletId(String walletId) async {
    await _secure.write(key: _activeKey, value: walletId);
    _activeIdCache = walletId;
    _activeIdLoaded = true;
  }

  Future<void> saveWallet({
    required String mnemonic,
    required WalletVaultRecord wallet,
  }) async {
    await _migrateLegacyIfNeeded();
    await _secure.write(key: _mnemonicKey(wallet.walletId), value: mnemonic);
    await _secure.write(key: _walletKey(wallet.walletId), value: wallet.encode());
    final index = await listVaults();
    final entry = VaultIndexEntry(
      walletId: wallet.walletId,
      name: wallet.name,
      createdAt: wallet.createdAt,
      backupConfirmed: wallet.backupConfirmed,
    );
    final next = [
      for (final item in index)
        if (item.walletId != wallet.walletId) item,
      entry,
    ];
    await _writeIndex(next);
    final active = await activeWalletId();
    if (active == null || active.isEmpty) {
      await setActiveWalletId(wallet.walletId);
    }
  }

  Future<String?> readMnemonic({String? walletId}) async {
    await _migrateLegacyIfNeeded();
    final id = walletId ?? await activeWalletId();
    if (id == null) return null;
    return _secure.read(key: _mnemonicKey(id));
  }

  Future<WalletVaultRecord?> readWallet({String? walletId}) async {
    await _migrateLegacyIfNeeded();
    final id = walletId ?? await activeWalletId();
    if (id == null) return null;
    final raw = await _secure.read(key: _walletKey(id));
    if (raw == null || raw.isEmpty) return null;
    return WalletVaultRecord.decode(raw);
  }

  Future<void> renameVault({required String walletId, required String name}) async {
    final wallet = await readWallet(walletId: walletId);
    final mnemonic = await readMnemonic(walletId: walletId);
    if (wallet == null || mnemonic == null) return;
    final next = wallet.copyWith(name: name.trim().isEmpty ? wallet.name : name.trim());
    await saveWallet(mnemonic: mnemonic, wallet: next);
  }

  Future<bool> deleteVault(String walletId) async {
    final vaults = await listVaults();
    if (vaults.length <= 1) return false;
    await _secure.delete(key: _mnemonicKey(walletId));
    await _secure.delete(key: _walletKey(walletId));
    final next = [for (final v in vaults) if (v.walletId != walletId) v];
    await _writeIndex(next);
    final active = await activeWalletId();
    if (active == walletId && next.isNotEmpty) {
      await setActiveWalletId(next.first.walletId);
    }
    return true;
  }

  Future<void> clearWalletEngineState() async {
    final vaults = await listVaults();
    for (final v in vaults) {
      await _secure.delete(key: _mnemonicKey(v.walletId));
      await _secure.delete(key: _walletKey(v.walletId));
    }
    await _secure.delete(key: _indexKey);
    await _secure.delete(key: _activeKey);
    await _secure.delete(key: _legacyMnemonicKey);
    await _secure.delete(key: _legacyWalletKey);
    _indexCache = const [];
    _activeIdCache = null;
    _activeIdLoaded = true;
    _migrationDone = true;
  }

  Future<void> _writeIndex(List<VaultIndexEntry> vaults) async {
    _indexCache = List.of(vaults);
    await _secure.write(
      key: _indexKey,
      value: jsonEncode([for (final v in vaults) v.toJson()]),
    );
  }

  Future<void> _migrateLegacyIfNeeded() async {
    if (_migrationDone) return;
    final inFlight = _migrationInFlight;
    if (inFlight != null) {
      await inFlight;
      return;
    }
    final run = _runLegacyMigration();
    _migrationInFlight = run;
    try {
      await run;
    } finally {
      if (identical(_migrationInFlight, run)) {
        _migrationInFlight = null;
      }
    }
  }

  Future<void> _runLegacyMigration() async {
    final existing = await _secure.read(key: _indexKey);
    if (existing != null && existing.isNotEmpty) {
      _migrationDone = true;
      return;
    }

    final legacyMnemonic = await _secure.read(key: _legacyMnemonicKey);
    final legacyWalletRaw = await _secure.read(key: _legacyWalletKey);
    if (legacyMnemonic == null || legacyWalletRaw == null) {
      _migrationDone = true;
      return;
    }

    final wallet = WalletVaultRecord.decode(legacyWalletRaw);
    final named = wallet.name.trim().isEmpty ? wallet.copyWith(name: 'Primary wallet') : wallet;
    await _secure.write(key: _mnemonicKey(named.walletId), value: legacyMnemonic);
    await _secure.write(key: _walletKey(named.walletId), value: named.encode());
    await _writeIndex([
      VaultIndexEntry(
        walletId: named.walletId,
        name: named.name,
        createdAt: named.createdAt,
        backupConfirmed: named.backupConfirmed,
      ),
    ]);
    await setActiveWalletId(named.walletId);
    await _secure.delete(key: _legacyMnemonicKey);
    await _secure.delete(key: _legacyWalletKey);
    _migrationDone = true;
  }
}

class VaultIndexEntry {
  const VaultIndexEntry({
    required this.walletId,
    required this.name,
    required this.createdAt,
    this.backupConfirmed = false,
  });

  final String walletId;
  final String name;
  final DateTime createdAt;
  final bool backupConfirmed;

  Map<String, Object?> toJson() => {
        'walletId': walletId,
        'name': name,
        'createdAt': createdAt.toIso8601String(),
        'backupConfirmed': backupConfirmed,
      };

  factory VaultIndexEntry.fromJson(Map<String, Object?> json) => VaultIndexEntry(
        walletId: (json['walletId'] as String?) ?? '',
        name: (json['name'] as String?) ?? 'Wallet',
        createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '') ?? DateTime.now(),
        backupConfirmed: json['backupConfirmed'] == true,
      );
}
