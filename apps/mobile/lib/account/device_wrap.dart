import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart' as crypto;
import 'package:pointycastle/export.dart';
import 'package:x25519/x25519.dart' as x25519;

/// Wire format must match `@auvora/vault-crypto` (`auvora-device-wrap-v1`).
const String kDeviceWrapAlg = 'auvora-device-wrap-v1';

class DeviceKeyPair {
  const DeviceKeyPair({required this.publicKey, required this.privateKey});

  final String publicKey;
  final String privateKey;
}

class DeviceWrappedVaultKey {
  const DeviceWrappedVaultKey({
    required this.algorithmId,
    required this.ciphertext,
    required this.nonce,
    required this.ephemeralPublicKey,
    required this.aad,
  });

  final String algorithmId;
  final String ciphertext;
  final String nonce;
  final String ephemeralPublicKey;
  final String aad;

  Map<String, Object?> toJson() => {
        'algorithmId': algorithmId,
        'ciphertext': ciphertext,
        'nonce': nonce,
        'ephemeralPublicKey': ephemeralPublicKey,
        'aad': aad,
      };

  factory DeviceWrappedVaultKey.fromJson(Map<String, dynamic> json) => DeviceWrappedVaultKey(
        algorithmId: (json['algorithmId'] ?? kDeviceWrapAlg).toString(),
        ciphertext: (json['ciphertext'] ?? '').toString(),
        nonce: (json['nonce'] ?? '').toString(),
        ephemeralPublicKey: (json['ephemeralPublicKey'] ?? '').toString(),
        aad: (json['aad'] ?? '').toString(),
      );
}

String _toBase64(Uint8List bytes) => base64Encode(bytes);

Uint8List _fromBase64(String value) => Uint8List.fromList(base64Decode(value));

Uint8List _randomBytes(int length) {
  final rnd = Random.secure();
  return Uint8List.fromList(List<int>.generate(length, (_) => rnd.nextInt(256)));
}

/// RFC5869 HKDF-SHA256 (extract+expand), matching Node device-wrap.
Uint8List hkdfSha256({
  required Uint8List ikm,
  required Uint8List salt,
  required String info,
  required int length,
}) {
  final prk = crypto.Hmac(crypto.sha256, salt).convert(ikm).bytes;
  final infoBytes = utf8.encode(info);
  final blocks = <Uint8List>[];
  var prev = Uint8List(0);
  var counter = 1;
  while (blocks.fold<int>(0, (sum, b) => sum + b.length) < length) {
    final input = Uint8List.fromList(<int>[...prev, ...infoBytes, counter]);
    final block = Uint8List.fromList(
      crypto.Hmac(crypto.sha256, prk).convert(input).bytes,
    );
    blocks.add(block);
    prev = block;
    counter += 1;
  }
  final out = Uint8List.fromList(blocks.expand((b) => b).toList());
  return Uint8List.sublistView(out, 0, length);
}

Uint8List _x25519SharedSecret(Uint8List privateKey, Uint8List publicKey) {
  return Uint8List.fromList(x25519.X25519(privateKey, publicKey));
}

/// AES-256-GCM for device-wrap: `ciphertext || tag(16)`, nonce supplied separately.
Uint8List _deviceWrapAesGcmEncrypt({
  required Uint8List key,
  required Uint8List plaintext,
  required String aad,
  required Uint8List nonce,
}) {
  final cipher = GCMBlockCipher(AESEngine())
    ..init(
      true,
      AEADParameters(KeyParameter(key), 128, nonce, utf8.encode(aad)),
    );
  final processed = cipher.process(plaintext);
  if (processed.length < 16) {
    throw StateError('AES-GCM encrypt produced invalid output');
  }
  final encrypted = processed.sublist(0, processed.length - 16);
  final tag = processed.sublist(processed.length - 16);
  return Uint8List.fromList(<int>[...encrypted, ...tag]);
}

Uint8List _deviceWrapAesGcmDecrypt({
  required Uint8List key,
  required Uint8List payload,
  required String aad,
  required Uint8List nonce,
}) {
  if (payload.length < 17) {
    throw StateError('Invalid device wrap ciphertext');
  }
  final encrypted = payload.sublist(0, payload.length - 16);
  final tag = payload.sublist(payload.length - 16);
  final cipher = GCMBlockCipher(AESEngine())
    ..init(
      false,
      AEADParameters(KeyParameter(key), 128, nonce, utf8.encode(aad)),
    );
  return cipher.process(Uint8List.fromList(<int>[...encrypted, ...tag]));
}

Uint8List _deviceWrapSalt(String requestId) {
  final input = utf8.encode('$kDeviceWrapAlg|$requestId');
  return Uint8List.fromList(crypto.sha256.convert(input).bytes);
}

String _deviceWrapAad({required String ownerUserId, required String requestId}) =>
    '$kDeviceWrapAlg|$ownerUserId|$requestId';

/// Generate an X25519 keypair for a requesting device (client-side only).
DeviceKeyPair generateDeviceRecoveryKeyPair() {
  final pair = x25519.generateKeyPair();
  return DeviceKeyPair(
    publicKey: _toBase64(Uint8List.fromList(pair.publicKey)),
    privateKey: _toBase64(Uint8List.fromList(pair.privateKey)),
  );
}

/// Wrap a 32-byte vault key for a requesting device public key (trusted device).
DeviceWrappedVaultKey wrapVaultKeyForDevice({
  required Uint8List vaultKey,
  required String recipientPublicKey,
  required String requestId,
  required String ownerUserId,
}) {
  if (vaultKey.length != 32) {
    throw ArgumentError('Vault key must be 32 bytes');
  }
  final recipientPk = _fromBase64(recipientPublicKey);
  final ephemeral = x25519.generateKeyPair();
  final shared = _x25519SharedSecret(
    Uint8List.fromList(ephemeral.privateKey),
    recipientPk,
  );
  final salt = _deviceWrapSalt(requestId);
  final aad = _deviceWrapAad(ownerUserId: ownerUserId, requestId: requestId);
  final aesKey = hkdfSha256(ikm: shared, salt: salt, info: 'auvora-device-wrap', length: 32);
  final nonce = _randomBytes(12);
  final ciphertext = _deviceWrapAesGcmEncrypt(
    key: aesKey,
    plaintext: vaultKey,
    aad: aad,
    nonce: nonce,
  );
  return DeviceWrappedVaultKey(
    algorithmId: kDeviceWrapAlg,
    ciphertext: _toBase64(ciphertext),
    nonce: _toBase64(nonce),
    ephemeralPublicKey: _toBase64(Uint8List.fromList(ephemeral.publicKey)),
    aad: aad,
  );
}

/// Unwrap a vault key on the requesting device using its private key.
Uint8List unwrapVaultKeyForDevice({
  required DeviceWrappedVaultKey wrapped,
  required String recipientPrivateKey,
  required String requestId,
  required String ownerUserId,
}) {
  if (wrapped.algorithmId != kDeviceWrapAlg) {
    throw StateError('Unsupported device wrap algorithm');
  }
  final expectedAad = _deviceWrapAad(ownerUserId: ownerUserId, requestId: requestId);
  if (wrapped.aad != expectedAad) {
    throw StateError('Device wrap AAD mismatch');
  }
  final recipientSk = _fromBase64(recipientPrivateKey);
  final ephemeralPk = _fromBase64(wrapped.ephemeralPublicKey);
  final shared = _x25519SharedSecret(recipientSk, ephemeralPk);
  final salt = _deviceWrapSalt(requestId);
  final aesKey = hkdfSha256(ikm: shared, salt: salt, info: 'auvora-device-wrap', length: 32);
  final nonce = _fromBase64(wrapped.nonce);
  final payload = _fromBase64(wrapped.ciphertext);
  return _deviceWrapAesGcmDecrypt(key: aesKey, payload: payload, aad: wrapped.aad, nonce: nonce);
}
