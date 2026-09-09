/**
 * Device-to-device vault-key wrapping (X25519 ECDH + HKDF-SHA256 + AES-256-GCM).
 * Server relays ciphertext only — never sees the vault key plaintext.
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { x25519 } from '@noble/curves/ed25519.js';

export const DEVICE_WRAP_ALG = 'auvora-device-wrap-v1';

export type DeviceKeyPair = {
  publicKey: string;
  privateKey: string;
};

export type DeviceWrappedVaultKey = {
  algorithmId: typeof DEVICE_WRAP_ALG;
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
  aad: string;
};

function toB64(buf: Uint8Array): string {
  return Buffer.from(buf).toString('base64');
}

function fromB64(value: string): Buffer {
  return Buffer.from(value, 'base64');
}

function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: string, length: number): Buffer {
  const prk = createHmac('sha256', Buffer.from(salt)).update(Buffer.from(ikm)).digest();
  const infoBuf = Buffer.from(info, 'utf8');
  const blocks: Buffer[] = [];
  let prev = Buffer.alloc(0);
  let counter = 1;
  while (Buffer.concat(blocks).length < length) {
    const block = createHmac('sha256', prk)
      .update(Buffer.concat([prev, infoBuf, Buffer.from([counter])]))
      .digest();
    blocks.push(block);
    prev = block;
    counter += 1;
  }
  return Buffer.concat(blocks).subarray(0, length);
}

/** Generate an X25519 keypair for a requesting device (client-side only). */
export function generateDeviceRecoveryKeyPair(): DeviceKeyPair {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { publicKey: toB64(publicKey), privateKey: toB64(privateKey) };
}

/**
 * Wrap a 32-byte vault key for a requesting device public key.
 * Approving (trusted) device only — never run on server with plaintext vault keys.
 */
export function wrapVaultKeyForDevice(args: {
  vaultKey: Uint8Array;
  recipientPublicKey: string;
  requestId: string;
  ownerUserId: string;
}): DeviceWrappedVaultKey {
  if (args.vaultKey.length !== 32) {
    throw new Error('Vault key must be 32 bytes');
  }
  const recipientPk = fromB64(args.recipientPublicKey);
  const ephemeralSk = x25519.utils.randomPrivateKey();
  const ephemeralPk = x25519.getPublicKey(ephemeralSk);
  const shared = x25519.getSharedSecret(ephemeralSk, recipientPk);
  const salt = createHash('sha256').update(`${DEVICE_WRAP_ALG}|${args.requestId}`).digest();
  const aad = `${DEVICE_WRAP_ALG}|${args.ownerUserId}|${args.requestId}`;
  const aesKey = hkdfSha256(shared, salt, 'auvora-device-wrap', 32);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(Buffer.from(args.vaultKey)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithmId: DEVICE_WRAP_ALG,
    ciphertext: toB64(Buffer.concat([encrypted, tag])),
    nonce: toB64(nonce),
    ephemeralPublicKey: toB64(ephemeralPk),
    aad,
  };
}

/** Unwrap a vault key on the requesting device using its private key. */
export function unwrapVaultKeyForDevice(args: {
  wrapped: DeviceWrappedVaultKey;
  recipientPrivateKey: string;
  requestId: string;
  ownerUserId: string;
}): Buffer {
  if (args.wrapped.algorithmId !== DEVICE_WRAP_ALG) {
    throw new Error('Unsupported device wrap algorithm');
  }
  const expectedAad = `${DEVICE_WRAP_ALG}|${args.ownerUserId}|${args.requestId}`;
  if (args.wrapped.aad !== expectedAad) {
    throw new Error('Device wrap AAD mismatch');
  }
  const recipientSk = fromB64(args.recipientPrivateKey);
  const ephemeralPk = fromB64(args.wrapped.ephemeralPublicKey);
  const shared = x25519.getSharedSecret(recipientSk, ephemeralPk);
  const salt = createHash('sha256').update(`${DEVICE_WRAP_ALG}|${args.requestId}`).digest();
  const aesKey = hkdfSha256(shared, salt, 'auvora-device-wrap', 32);
  const nonce = fromB64(args.wrapped.nonce);
  const payload = fromB64(args.wrapped.ciphertext);
  if (payload.length < 17) {
    throw new Error('Invalid device wrap ciphertext');
  }
  const encrypted = payload.subarray(0, payload.length - 16);
  const tag = payload.subarray(payload.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', aesKey, nonce);
  decipher.setAAD(Buffer.from(args.wrapped.aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
