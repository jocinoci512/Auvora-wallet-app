import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:hashlib/hashlib.dart';
import 'package:pointycastle/export.dart';

/// Wire format must match `@auvora/vault-crypto` (`auvora-vault-v1`).
const String kVaultAlgorithmId = 'auvora-vault-v1';

class VaultKdfParams {
  const VaultKdfParams({
    this.type = 'argon2id',
    this.memoryCost = 65536,
    this.timeCost = 3,
    this.parallelism = 4,
    this.hashLength = 32,
  });

  final String type;
  final int memoryCost;
  final int timeCost;
  final int parallelism;
  final int hashLength;

  Map<String, Object?> toJson() => {
        'type': type,
        'memoryCost': memoryCost,
        'timeCost': timeCost,
        'parallelism': parallelism,
        'hashLength': hashLength,
      };

  factory VaultKdfParams.fromJson(Map<String, dynamic> json) => VaultKdfParams(
        type: (json['type'] as String?) ?? 'argon2id',
        memoryCost: (json['memoryCost'] as num?)?.toInt() ?? 65536,
        timeCost: (json['timeCost'] as num?)?.toInt() ?? 3,
        parallelism: (json['parallelism'] as num?)?.toInt() ?? 4,
        hashLength: (json['hashLength'] as num?)?.toInt() ?? 32,
      );
}

const VaultKdfParams kDefaultVaultKdfParams = VaultKdfParams();
const VaultKdfParams kRecoveryVaultKdfParams = VaultKdfParams();

class VaultWalletEntry {
  const VaultWalletEntry({
    required this.walletId,
    required this.mnemonic,
    this.label,
    this.metadata,
  });

  final String walletId;
  final String mnemonic;
  final String? label;
  final Map<String, dynamic>? metadata;

  Map<String, Object?> toJson() => {
        'walletId': walletId,
        'mnemonic': mnemonic,
        if (label != null) 'label': label,
        if (metadata != null) 'metadata': metadata,
      };

  factory VaultWalletEntry.fromJson(Map<String, dynamic> json) => VaultWalletEntry(
        walletId: (json['walletId'] ?? '').toString(),
        mnemonic: (json['mnemonic'] ?? '').toString(),
        label: json['label'] as String?,
        metadata: json['metadata'] is Map
            ? Map<String, dynamic>.from(json['metadata'] as Map)
            : null,
      );
}

class VaultPlaintextBundle {
  const VaultPlaintextBundle({this.version = 1, required this.wallets});

  final int version;
  final List<VaultWalletEntry> wallets;

  Map<String, Object?> toJson() => {
        'version': version,
        'wallets': [for (final w in wallets) w.toJson()],
      };

  factory VaultPlaintextBundle.fromJson(Map<String, dynamic> json) {
    final raw = json['wallets'];
    final wallets = <VaultWalletEntry>[];
    if (raw is List) {
      for (final item in raw) {
        if (item is Map) {
          wallets.add(VaultWalletEntry.fromJson(Map<String, dynamic>.from(item)));
        }
      }
    }
    return VaultPlaintextBundle(
      version: (json['version'] as num?)?.toInt() ?? 1,
      wallets: wallets,
    );
  }
}

class EncryptedVaultEnvelope {
  const EncryptedVaultEnvelope({
    required this.algorithmId,
    required this.version,
    required this.kdfSalt,
    required this.kdfParams,
    required this.recoveryKdfSalt,
    required this.recoveryKdfParams,
    required this.wrappedVaultKey,
    required this.wrappedVaultKeyRecovery,
    required this.ciphertext,
    required this.aad,
    this.epoch,
  });

  final String algorithmId;
  final int version;
  final String kdfSalt;
  final VaultKdfParams kdfParams;
  final String recoveryKdfSalt;
  final VaultKdfParams recoveryKdfParams;
  final String wrappedVaultKey;
  final String wrappedVaultKeyRecovery;
  final String ciphertext;
  final String aad;
  final int? epoch;

  Map<String, Object?> toJson() => {
        'algorithmId': algorithmId,
        'version': version,
        if (epoch != null) 'epoch': epoch,
        'kdfSalt': kdfSalt,
        'kdfParams': kdfParams.toJson(),
        'recoveryKdfSalt': recoveryKdfSalt,
        'recoveryKdfParams': recoveryKdfParams.toJson(),
        'wrappedVaultKey': wrappedVaultKey,
        'wrappedVaultKeyRecovery': wrappedVaultKeyRecovery,
        'ciphertext': ciphertext,
        'aad': aad,
      };

  factory EncryptedVaultEnvelope.fromJson(Map<String, dynamic> json) => EncryptedVaultEnvelope(
        algorithmId: (json['algorithmId'] ?? '').toString(),
        version: (json['version'] as num?)?.toInt() ?? 1,
        epoch: (json['epoch'] as num?)?.toInt(),
        kdfSalt: (json['kdfSalt'] ?? '').toString(),
        kdfParams: json['kdfParams'] is Map
            ? VaultKdfParams.fromJson(Map<String, dynamic>.from(json['kdfParams'] as Map))
            : kDefaultVaultKdfParams,
        recoveryKdfSalt: (json['recoveryKdfSalt'] ?? '').toString(),
        recoveryKdfParams: json['recoveryKdfParams'] is Map
            ? VaultKdfParams.fromJson(Map<String, dynamic>.from(json['recoveryKdfParams'] as Map))
            : kRecoveryVaultKdfParams,
        wrappedVaultKey: (json['wrappedVaultKey'] ?? '').toString(),
        wrappedVaultKeyRecovery: (json['wrappedVaultKeyRecovery'] ?? '').toString(),
        ciphertext: (json['ciphertext'] ?? '').toString(),
        aad: (json['aad'] ?? '').toString(),
      );
}

class VaultUploadPayload extends EncryptedVaultEnvelope {
  VaultUploadPayload({
    required super.algorithmId,
    required super.version,
    required int epoch,
    required super.kdfSalt,
    required super.kdfParams,
    required super.recoveryKdfSalt,
    required super.recoveryKdfParams,
    required super.wrappedVaultKey,
    required super.wrappedVaultKeyRecovery,
    required super.ciphertext,
    required super.aad,
  }) : super(epoch: epoch);

  @override
  int get epoch => super.epoch!;
}

String buildVaultAad(String ownerUserId, int epoch) =>
    '$kVaultAlgorithmId|$ownerUserId|$epoch';

String normalizeRecoveryPhrase(String phrase) =>
    phrase.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

Uint8List _randomBytes(int length) {
  final rnd = Random.secure();
  return Uint8List.fromList(List<int>.generate(length, (_) => rnd.nextInt(256)));
}

String _toBase64(Uint8List bytes) => base64Encode(bytes);

Uint8List _fromBase64(String value) => Uint8List.fromList(base64Decode(value));

Uint8List deriveArgon2idKey({
  required String secret,
  required Uint8List salt,
  required VaultKdfParams params,
}) {
  final digest = Argon2(
    type: Argon2Type.argon2id,
    salt: salt,
    hashLength: params.hashLength,
    iterations: params.timeCost,
    parallelism: params.parallelism,
    memorySizeKB: params.memoryCost,
  ).convert(utf8.encode(secret));
  return Uint8List.fromList(digest.bytes);
}

/// AES-256-GCM payload layout: `iv(12) || tag(16) || ciphertext`.
Uint8List aesGcmEncrypt({
  required Uint8List key,
  required Uint8List plaintext,
  required String aad,
}) {
  final iv = _randomBytes(12);
  final cipher = GCMBlockCipher(AESEngine())
    ..init(
      true,
      AEADParameters(KeyParameter(key), 128, iv, utf8.encode(aad)),
    );
  final processed = cipher.process(plaintext);
  if (processed.length < 16) {
    throw StateError('AES-GCM encrypt produced invalid output');
  }
  final ciphertext = processed.sublist(0, processed.length - 16);
  final tag = processed.sublist(processed.length - 16);
  return Uint8List.fromList(<int>[...iv, ...tag, ...ciphertext]);
}

Uint8List aesGcmDecrypt({
  required Uint8List key,
  required Uint8List payload,
  required String aad,
}) {
  if (payload.length < 12 + 16 + 1) {
    throw StateError('Invalid encrypted payload');
  }
  final iv = payload.sublist(0, 12);
  final tag = payload.sublist(12, 28);
  final ciphertext = payload.sublist(28);
  final cipher = GCMBlockCipher(AESEngine())
    ..init(
      false,
      AEADParameters(KeyParameter(key), 128, iv, utf8.encode(aad)),
    );
  return cipher.process(Uint8List.fromList(<int>[...ciphertext, ...tag]));
}

Future<VaultUploadPayload> encryptVaultBundle({
  required String ownerUserId,
  required int epoch,
  required String password,
  required String recoveryPhrase,
  required VaultPlaintextBundle bundle,
}) async {
  final kdfSalt = _randomBytes(16);
  final recoveryKdfSalt = _randomBytes(16);
  final vaultKey = _randomBytes(32);
  final aad = buildVaultAad(ownerUserId, epoch);

  final passwordKey = deriveArgon2idKey(
    secret: password,
    salt: kdfSalt,
    params: kDefaultVaultKdfParams,
  );
  final recoveryKey = deriveArgon2idKey(
    secret: normalizeRecoveryPhrase(recoveryPhrase),
    salt: recoveryKdfSalt,
    params: kRecoveryVaultKdfParams,
  );

  final wrapAad = '$aad|wrap-password';
  final recoveryWrapAad = '$aad|wrap-recovery';
  final ciphertextAad = '$aad|bundle';

  final wrappedVaultKey = aesGcmEncrypt(key: passwordKey, plaintext: vaultKey, aad: wrapAad);
  final wrappedVaultKeyRecovery =
      aesGcmEncrypt(key: recoveryKey, plaintext: vaultKey, aad: recoveryWrapAad);
  final ciphertext = aesGcmEncrypt(
    key: vaultKey,
    plaintext: Uint8List.fromList(utf8.encode(jsonEncode(bundle.toJson()))),
    aad: ciphertextAad,
  );

  return VaultUploadPayload(
    algorithmId: kVaultAlgorithmId,
    version: 1,
    epoch: epoch,
    kdfSalt: _toBase64(kdfSalt),
    kdfParams: kDefaultVaultKdfParams,
    recoveryKdfSalt: _toBase64(recoveryKdfSalt),
    recoveryKdfParams: kRecoveryVaultKdfParams,
    wrappedVaultKey: _toBase64(wrappedVaultKey),
    wrappedVaultKeyRecovery: _toBase64(wrappedVaultKeyRecovery),
    ciphertext: _toBase64(ciphertext),
    aad: aad,
  );
}

Future<VaultPlaintextBundle> decryptVaultBundle({
  required String ownerUserId,
  required EncryptedVaultEnvelope envelope,
  required int epoch,
  String? password,
  String? recoveryPhrase,
}) async {
  if (envelope.algorithmId != kVaultAlgorithmId) {
    throw StateError('Unsupported vault algorithm');
  }
  final aad = buildVaultAad(ownerUserId, epoch);
  final wrapAad = '$aad|wrap-password';
  final recoveryWrapAad = '$aad|wrap-recovery';
  final ciphertextAad = '$aad|bundle';

  Uint8List? vaultKey;

  if (password != null && password.isNotEmpty) {
    final passwordKey = deriveArgon2idKey(
      secret: password,
      salt: _fromBase64(envelope.kdfSalt),
      params: envelope.kdfParams,
    );
    try {
      vaultKey = aesGcmDecrypt(
        key: passwordKey,
        payload: _fromBase64(envelope.wrappedVaultKey),
        aad: wrapAad,
      );
    } catch (_) {
      vaultKey = null;
    }
  }

  if (vaultKey == null && recoveryPhrase != null && recoveryPhrase.isNotEmpty) {
    final recoveryKey = deriveArgon2idKey(
      secret: normalizeRecoveryPhrase(recoveryPhrase),
      salt: _fromBase64(envelope.recoveryKdfSalt),
      params: envelope.recoveryKdfParams,
    );
    vaultKey = aesGcmDecrypt(
      key: recoveryKey,
      payload: _fromBase64(envelope.wrappedVaultKeyRecovery),
      aad: recoveryWrapAad,
    );
  }

  if (vaultKey == null) {
    throw StateError('Unable to decrypt vault — check password or recovery phrase');
  }

  final plaintext = aesGcmDecrypt(
    key: vaultKey,
    payload: _fromBase64(envelope.ciphertext),
    aad: ciphertextAad,
  );
  final decoded = jsonDecode(utf8.decode(plaintext));
  if (decoded is! Map) {
    throw StateError('Invalid vault bundle format');
  }
  final bundle = VaultPlaintextBundle.fromJson(Map<String, dynamic>.from(decoded));
  if (bundle.version != 1 || bundle.wallets.isEmpty) {
    throw StateError('Invalid vault bundle format');
  }
  return bundle;
}

/// After an account password reset, clients must re-wrap the vault key with the
/// new password using the recovery phrase (client-side only). The server never
/// holds plaintext and cannot rotate wraps for you.
Future<VaultUploadPayload> rewrapVaultWithNewPassword({
  required String ownerUserId,
  required EncryptedVaultEnvelope envelope,
  required int epoch,
  required String recoveryPhrase,
  required String newPassword,
}) async {
  final bundle = await decryptVaultBundle(
    ownerUserId: ownerUserId,
    envelope: envelope,
    epoch: epoch,
    recoveryPhrase: recoveryPhrase,
  );
  return encryptVaultBundle(
    ownerUserId: ownerUserId,
    epoch: epoch + 1,
    password: newPassword,
    recoveryPhrase: recoveryPhrase,
    bundle: bundle,
  );
}
