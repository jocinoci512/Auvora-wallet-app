import {
  generateDeviceRecoveryKeyPair,
  wrapVaultKeyForDevice,
  unwrapVaultKeyForDevice,
  DEVICE_WRAP_ALG,
} from '../src/device-wrap';
import { randomBytes } from 'node:crypto';

describe('device-wrap', () => {
  it('round-trips a 32-byte vault key', () => {
    const recipient = generateDeviceRecoveryKeyPair();
    const vaultKey = randomBytes(32);
    const requestId = '11111111-1111-4111-8111-111111111111';
    const ownerUserId = '22222222-2222-4222-8222-222222222222';
    const wrapped = wrapVaultKeyForDevice({
      vaultKey,
      recipientPublicKey: recipient.publicKey,
      requestId,
      ownerUserId,
    });
    expect(wrapped.algorithmId).toBe(DEVICE_WRAP_ALG);
    expect(wrapped.aad).toBe(`${DEVICE_WRAP_ALG}|${ownerUserId}|${requestId}`);
    const unwrapped = unwrapVaultKeyForDevice({
      wrapped,
      recipientPrivateKey: recipient.privateKey,
      requestId,
      ownerUserId,
    });
    expect(Buffer.compare(unwrapped, vaultKey)).toBe(0);
  });

  it('rejects AAD / request mismatches', () => {
    const recipient = generateDeviceRecoveryKeyPair();
    const vaultKey = randomBytes(32);
    const requestId = '11111111-1111-4111-8111-111111111111';
    const ownerUserId = '22222222-2222-4222-8222-222222222222';
    const wrapped = wrapVaultKeyForDevice({
      vaultKey,
      recipientPublicKey: recipient.publicKey,
      requestId,
      ownerUserId,
    });
    expect(() =>
      unwrapVaultKeyForDevice({
        wrapped,
        recipientPrivateKey: recipient.privateKey,
        requestId: '33333333-3333-4333-8333-333333333333',
        ownerUserId,
      }),
    ).toThrow(/AAD mismatch/);
  });

  it('rejects wrong recipient private key', () => {
    const recipient = generateDeviceRecoveryKeyPair();
    const other = generateDeviceRecoveryKeyPair();
    const vaultKey = randomBytes(32);
    const requestId = '11111111-1111-4111-8111-111111111111';
    const ownerUserId = '22222222-2222-4222-8222-222222222222';
    const wrapped = wrapVaultKeyForDevice({
      vaultKey,
      recipientPublicKey: recipient.publicKey,
      requestId,
      ownerUserId,
    });
    expect(() =>
      unwrapVaultKeyForDevice({
        wrapped,
        recipientPrivateKey: other.privateKey,
        requestId,
        ownerUserId,
      }),
    ).toThrow();
  });
});
