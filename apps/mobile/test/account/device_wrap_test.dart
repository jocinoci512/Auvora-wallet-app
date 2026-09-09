import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:auvora_wallet/account/device_wrap.dart';

void main() {
  test('device wrap roundtrip preserves 32-byte vault key', () {
    const ownerUserId = '00000000-0000-4000-8000-000000000001';
    const requestId = '11111111-1111-4111-8111-111111111111';
    final recipient = generateDeviceRecoveryKeyPair();
    final vaultKey = Uint8List.fromList(List<int>.generate(32, (i) => i + 1));

    final wrapped = wrapVaultKeyForDevice(
      vaultKey: vaultKey,
      recipientPublicKey: recipient.publicKey,
      requestId: requestId,
      ownerUserId: ownerUserId,
    );

    expect(wrapped.algorithmId, kDeviceWrapAlg);
    expect(wrapped.aad, '$kDeviceWrapAlg|$ownerUserId|$requestId');

    final unwrapped = unwrapVaultKeyForDevice(
      wrapped: wrapped,
      recipientPrivateKey: recipient.privateKey,
      requestId: requestId,
      ownerUserId: ownerUserId,
    );

    expect(unwrapped, vaultKey);
  });

  test('device wrap rejects AAD mismatch', () {
    final recipient = generateDeviceRecoveryKeyPair();
    final vaultKey = Uint8List(32);
    final wrapped = wrapVaultKeyForDevice(
      vaultKey: vaultKey,
      recipientPublicKey: recipient.publicKey,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ownerUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    );

    expect(
      () => unwrapVaultKeyForDevice(
        wrapped: wrapped,
        recipientPrivateKey: recipient.privateKey,
        requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        ownerUserId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      ),
      throwsA(isA<StateError>()),
    );
  });
}
