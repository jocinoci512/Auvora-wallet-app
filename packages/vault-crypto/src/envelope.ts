import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';
import { DEFAULT_KDF_PARAMS, RECOVERY_KDF_PARAMS, VAULT_ALGORITHM_ID } from './constants.js';

export type KdfParams = {
  type: 'argon2id';
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  hashLength: number;
};

export type VaultWalletEntry = {
  walletId: string;
  mnemonic: string;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Plaintext wallet bundle encrypted inside the vault ciphertext. Never sent to server unencrypted. */
export type VaultPlaintextBundle = {
  version: 1;
  wallets: VaultWalletEntry[];
};

export type EncryptedVaultEnvelope = {
  algorithmId: typeof VAULT_ALGORITHM_ID;
  version: 1;
  kdfSalt: string;
  kdfParams: KdfParams;
  recoveryKdfSalt: string;
  recoveryKdfParams: KdfParams;
  wrappedVaultKey: string;
  wrappedVaultKeyRecovery: string;
  ciphertext: string;
  aad: string;
};

export type VaultUploadPayload = EncryptedVaultEnvelope & {
  epoch: number;
};

function toBase64(buf: Buffer): string {
  return buf.toString('base64');
}

function fromBase64(value: string): Buffer {
  return Buffer.from(value, 'base64');
}

function buildAad(ownerUserId: string, epoch: number): string {
  return `${VAULT_ALGORITHM_ID}|${ownerUserId}|${epoch}`;
}

async function deriveKey(secret: string, salt: Buffer, params: KdfParams): Promise<Buffer> {
  const raw = await argon2.hash(secret, {
    type: argon2.argon2id,
    salt,
    memoryCost: params.memoryCost,
    timeCost: params.timeCost,
    parallelism: params.parallelism,
    hashLength: params.hashLength,
    raw: true,
  });
  return Buffer.from(raw);
}

function aesGcmEncrypt(key: Buffer, plaintext: Buffer, aad: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

function aesGcmDecrypt(key: Buffer, payload: Buffer, aad: string): Buffer {
  if (payload.length < 12 + 16 + 1) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function normalizeRecoveryPhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Reject obvious plaintext secret leakage in API payloads. */
export function assertNoPlaintextSecrets(input: Record<string, unknown>): void {
  const forbidden = /mnemonic|seed phrase|private key|secret phrase/i;
  for (const [key, value] of Object.entries(input)) {
    if (forbidden.test(key)) {
      throw new Error(`Forbidden field: ${key}`);
    }
    if (
      typeof value === 'string' &&
      value.split(' ').length >= 12 &&
      /^[a-z]+(\s[a-z]+)+$/i.test(value)
    ) {
      throw new Error('Plaintext mnemonic-like payload rejected');
    }
  }
}

export async function encryptVaultBundle(args: {
  ownerUserId: string;
  epoch: number;
  password: string;
  recoveryPhrase: string;
  bundle: VaultPlaintextBundle;
}): Promise<VaultUploadPayload> {
  const kdfSalt = randomBytes(16);
  const recoveryKdfSalt = randomBytes(16);
  const vaultKey = randomBytes(32);
  const aad = buildAad(args.ownerUserId, args.epoch);

  const passwordKey = await deriveKey(args.password, kdfSalt, DEFAULT_KDF_PARAMS);
  const recoveryKey = await deriveKey(
    normalizeRecoveryPhrase(args.recoveryPhrase),
    recoveryKdfSalt,
    RECOVERY_KDF_PARAMS,
  );

  const wrapAad = `${aad}|wrap-password`;
  const recoveryWrapAad = `${aad}|wrap-recovery`;
  const ciphertextAad = `${aad}|bundle`;

  const wrappedVaultKey = aesGcmEncrypt(passwordKey, vaultKey, wrapAad);
  const wrappedVaultKeyRecovery = aesGcmEncrypt(recoveryKey, vaultKey, recoveryWrapAad);
  const ciphertext = aesGcmEncrypt(
    vaultKey,
    Buffer.from(JSON.stringify(args.bundle), 'utf8'),
    ciphertextAad,
  );

  return {
    algorithmId: VAULT_ALGORITHM_ID,
    version: 1,
    kdfSalt: toBase64(kdfSalt),
    kdfParams: DEFAULT_KDF_PARAMS,
    recoveryKdfSalt: toBase64(recoveryKdfSalt),
    recoveryKdfParams: RECOVERY_KDF_PARAMS,
    wrappedVaultKey: toBase64(wrappedVaultKey),
    wrappedVaultKeyRecovery: toBase64(wrappedVaultKeyRecovery),
    ciphertext: toBase64(ciphertext),
    aad,
    epoch: args.epoch,
  };
}

export async function decryptVaultBundle(args: {
  ownerUserId: string;
  envelope: EncryptedVaultEnvelope;
  epoch: number;
  password?: string;
  recoveryPhrase?: string;
}): Promise<VaultPlaintextBundle> {
  if (args.envelope.algorithmId !== VAULT_ALGORITHM_ID) {
    throw new Error('Unsupported vault algorithm');
  }
  const aad = buildAad(args.ownerUserId, args.epoch);
  const wrapAad = `${aad}|wrap-password`;
  const recoveryWrapAad = `${aad}|wrap-recovery`;
  const ciphertextAad = `${aad}|bundle`;

  let vaultKey: Buffer | null = null;

  if (args.password) {
    const passwordKey = await deriveKey(
      args.password,
      fromBase64(args.envelope.kdfSalt),
      args.envelope.kdfParams,
    );
    try {
      vaultKey = aesGcmDecrypt(passwordKey, fromBase64(args.envelope.wrappedVaultKey), wrapAad);
    } catch {
      vaultKey = null;
    }
  }

  if (!vaultKey && args.recoveryPhrase) {
    const recoveryKey = await deriveKey(
      normalizeRecoveryPhrase(args.recoveryPhrase),
      fromBase64(args.envelope.recoveryKdfSalt),
      args.envelope.recoveryKdfParams,
    );
    vaultKey = aesGcmDecrypt(
      recoveryKey,
      fromBase64(args.envelope.wrappedVaultKeyRecovery),
      recoveryWrapAad,
    );
  }

  if (!vaultKey) {
    throw new Error('Unable to decrypt vault — check password or recovery phrase');
  }

  const plaintext = aesGcmDecrypt(vaultKey, fromBase64(args.envelope.ciphertext), ciphertextAad);
  const bundle = JSON.parse(plaintext.toString('utf8')) as VaultPlaintextBundle;
  if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.wallets)) {
    throw new Error('Invalid vault bundle format');
  }
  return bundle;
}

/** Re-wrap vault key after account password change using recovery phrase. */
export async function rewrapVaultWithNewPassword(args: {
  ownerUserId: string;
  envelope: EncryptedVaultEnvelope;
  epoch: number;
  recoveryPhrase: string;
  newPassword: string;
}): Promise<VaultUploadPayload> {
  const bundle = await decryptVaultBundle({
    ownerUserId: args.ownerUserId,
    envelope: args.envelope,
    epoch: args.epoch,
    recoveryPhrase: args.recoveryPhrase,
  });
  return encryptVaultBundle({
    ownerUserId: args.ownerUserId,
    epoch: args.epoch + 1,
    password: args.newPassword,
    recoveryPhrase: args.recoveryPhrase,
    bundle,
  });
}

export function constantTimeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
