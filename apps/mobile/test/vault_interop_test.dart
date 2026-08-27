import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:auvora_wallet/account/vault_crypto.dart';

/// Loads the same golden fixture as packages/vault-crypto/src/fixtures/interop-vectors.json
/// (copied to test/fixtures for portable path resolution).
Map<String, dynamic> _loadFixture() {
  final candidates = <File>[
    File('test/fixtures/interop-vectors.json'),
    File('../test/fixtures/interop-vectors.json'),
    // Monorepo relative from apps/mobile when cwd is package root.
    File('../../packages/vault-crypto/src/fixtures/interop-vectors.json'),
  ];
  for (final file in candidates) {
    if (file.existsSync()) {
      return jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
    }
  }
  throw StateError(
    'interop-vectors.json not found — copy from packages/vault-crypto/src/fixtures/',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Map<String, dynamic> fixture;
  late String ownerUserId;
  late String password;
  late String recoveryPhrase;
  late int epoch;
  late EncryptedVaultEnvelope envelope;

  setUpAll(() {
    fixture = _loadFixture();
    ownerUserId = fixture['ownerUserId'] as String;
    password = fixture['password'] as String;
    recoveryPhrase = fixture['recoveryPhrase'] as String;
    epoch = (fixture['epoch'] as num).toInt();
    envelope = EncryptedVaultEnvelope.fromJson(
      Map<String, dynamic>.from(fixture['envelope'] as Map),
    );
  });

  test('Dart decrypts Node golden fixture with password', () async {
    final bundle = await decryptVaultBundle(
      ownerUserId: ownerUserId,
      envelope: envelope,
      epoch: epoch,
      password: password,
    );

    expect(bundle.version, 1);
    expect(bundle.wallets, isNotEmpty);
    expect(bundle.wallets.first.mnemonic, recoveryPhrase);
    expect(bundle.wallets.first.walletId, 'wallet-interop-1');
  });

  test('Dart decrypts Node golden fixture with recovery phrase', () async {
    final bundle = await decryptVaultBundle(
      ownerUserId: ownerUserId,
      envelope: envelope,
      epoch: epoch,
      recoveryPhrase: recoveryPhrase,
    );

    expect(bundle.wallets.first.mnemonic, recoveryPhrase);
  });

  test('Dart encrypt produces auvora-vault-v1 structure matching algorithm id', () async {
    final plaintext = VaultPlaintextBundle(
      wallets: [
        VaultWalletEntry(
          walletId: 'dart-roundtrip',
          mnemonic: recoveryPhrase,
          label: 'Dart',
        ),
      ],
    );

    final uploaded = await encryptVaultBundle(
      ownerUserId: ownerUserId,
      epoch: 9,
      password: password,
      recoveryPhrase: recoveryPhrase,
      bundle: plaintext,
    );

    expect(uploaded.algorithmId, kVaultAlgorithmId);
    expect(uploaded.algorithmId, 'auvora-vault-v1');
    expect(uploaded.version, 1);
    expect(uploaded.epoch, 9);
    expect(uploaded.aad, '$kVaultAlgorithmId|$ownerUserId|9');
    expect(uploaded.kdfSalt, isNotEmpty);
    expect(uploaded.recoveryKdfSalt, isNotEmpty);
    expect(uploaded.wrappedVaultKey, isNotEmpty);
    expect(uploaded.wrappedVaultKeyRecovery, isNotEmpty);
    expect(uploaded.ciphertext, isNotEmpty);
    expect(uploaded.kdfParams.type, 'argon2id');
    expect(uploaded.kdfParams.memoryCost, 65536);

    final roundTrip = await decryptVaultBundle(
      ownerUserId: ownerUserId,
      envelope: uploaded,
      epoch: 9,
      password: password,
    );
    expect(roundTrip.wallets.first.walletId, 'dart-roundtrip');
  });
}
