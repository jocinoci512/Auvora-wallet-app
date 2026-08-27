/**
 * Browser implementation of `@auvora/vault-crypto` wire format (`auvora-vault-v1`).
 * Uses Web Crypto AES-256-GCM + hash-wasm Argon2id. Never sends plaintext to the API.
 */

import { argon2id } from 'hash-wasm';

export const VAULT_ALGORITHM_ID = 'auvora-vault-v1' as const;

export type KdfParams = {
  type: 'argon2id';
  memoryCost: number;
  timeCost: number;
  parallelism: number;
  hashLength: number;
};

export const DEFAULT_KDF_PARAMS: KdfParams = {
  type: 'argon2id',
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
};

export const RECOVERY_KDF_PARAMS: KdfParams = { ...DEFAULT_KDF_PARAMS };

export type VaultWalletEntry = {
  walletId: string;
  mnemonic: string;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
};

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

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

export function buildVaultAad(ownerUserId: string, epoch: number): string {
  return `${VAULT_ALGORITHM_ID}|${ownerUserId}|${epoch}`;
}

function normalizeRecoveryPhrase(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function deriveKey(secret: string, salt: Uint8Array, params: KdfParams): Promise<Uint8Array> {
  return argon2id({
    password: secret,
    salt,
    parallelism: params.parallelism,
    iterations: params.timeCost,
    memorySize: params.memoryCost,
    hashLength: params.hashLength,
    outputType: 'binary',
  });
}

async function importAesKey(raw: Uint8Array): Promise<CryptoKey> {
  const copy = new Uint8Array(raw);
  return crypto.subtle.importKey('raw', copy, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** Layout: iv(12) || tag(16) || ciphertext — matches Node `vault-crypto`. */
async function aesGcmEncrypt(
  keyBytes: Uint8Array,
  plaintext: Uint8Array,
  aad: string,
): Promise<Uint8Array> {
  const iv = new Uint8Array(randomBytes(12));
  const key = await importAesKey(keyBytes);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: new TextEncoder().encode(aad),
        tagLength: 128,
      },
      key,
      new Uint8Array(plaintext),
    ),
  );
  // Web Crypto returns ciphertext || tag
  const tag = sealed.subarray(sealed.length - 16);
  const ciphertext = sealed.subarray(0, sealed.length - 16);
  const out = new Uint8Array(12 + 16 + ciphertext.length);
  out.set(iv, 0);
  out.set(tag, 12);
  out.set(ciphertext, 28);
  return out;
}

async function aesGcmDecrypt(
  keyBytes: Uint8Array,
  payload: Uint8Array,
  aad: string,
): Promise<Uint8Array> {
  if (payload.length < 12 + 16 + 1) throw new Error('Invalid encrypted payload');
  const iv = new Uint8Array(payload.subarray(0, 12));
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const sealed = new Uint8Array(ciphertext.length + 16);
  sealed.set(ciphertext, 0);
  sealed.set(tag, ciphertext.length);
  const key = await importAesKey(keyBytes);
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: new TextEncoder().encode(aad),
        tagLength: 128,
      },
      key,
      sealed,
    ),
  );
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
  const aad = buildVaultAad(args.ownerUserId, args.epoch);

  const passwordKey = await deriveKey(args.password, kdfSalt, DEFAULT_KDF_PARAMS);
  const recoveryKey = await deriveKey(
    normalizeRecoveryPhrase(args.recoveryPhrase),
    recoveryKdfSalt,
    RECOVERY_KDF_PARAMS,
  );

  const wrapAad = `${aad}|wrap-password`;
  const recoveryWrapAad = `${aad}|wrap-recovery`;
  const ciphertextAad = `${aad}|bundle`;

  const wrappedVaultKey = await aesGcmEncrypt(passwordKey, vaultKey, wrapAad);
  const wrappedVaultKeyRecovery = await aesGcmEncrypt(recoveryKey, vaultKey, recoveryWrapAad);
  const ciphertext = await aesGcmEncrypt(
    vaultKey,
    new TextEncoder().encode(JSON.stringify(args.bundle)),
    ciphertextAad,
  );

  return {
    algorithmId: VAULT_ALGORITHM_ID,
    version: 1,
    epoch: args.epoch,
    kdfSalt: toBase64(kdfSalt),
    kdfParams: DEFAULT_KDF_PARAMS,
    recoveryKdfSalt: toBase64(recoveryKdfSalt),
    recoveryKdfParams: RECOVERY_KDF_PARAMS,
    wrappedVaultKey: toBase64(wrappedVaultKey),
    wrappedVaultKeyRecovery: toBase64(wrappedVaultKeyRecovery),
    ciphertext: toBase64(ciphertext),
    aad,
  };
}

export async function decryptVaultBundle(args: {
  ownerUserId: string;
  envelope: EncryptedVaultEnvelope & { epoch?: number };
  epoch: number;
  password?: string;
  recoveryPhrase?: string;
}): Promise<VaultPlaintextBundle> {
  if (args.envelope.algorithmId !== VAULT_ALGORITHM_ID) {
    throw new Error('Unsupported vault algorithm');
  }
  const aad = buildVaultAad(args.ownerUserId, args.epoch);
  const wrapAad = `${aad}|wrap-password`;
  const recoveryWrapAad = `${aad}|wrap-recovery`;
  const ciphertextAad = `${aad}|bundle`;

  let vaultKey: Uint8Array | null = null;

  if (args.password) {
    const passwordKey = await deriveKey(
      args.password,
      fromBase64(args.envelope.kdfSalt),
      args.envelope.kdfParams,
    );
    try {
      vaultKey = await aesGcmDecrypt(
        passwordKey,
        fromBase64(args.envelope.wrappedVaultKey),
        wrapAad,
      );
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
    vaultKey = await aesGcmDecrypt(
      recoveryKey,
      fromBase64(args.envelope.wrappedVaultKeyRecovery),
      recoveryWrapAad,
    );
  }

  if (!vaultKey) {
    throw new Error('Unable to decrypt vault — check password or recovery phrase');
  }

  const plaintext = await aesGcmDecrypt(
    vaultKey,
    fromBase64(args.envelope.ciphertext),
    ciphertextAad,
  );
  const bundle = JSON.parse(new TextDecoder().decode(plaintext)) as VaultPlaintextBundle;
  if (!bundle || bundle.version !== 1 || !Array.isArray(bundle.wallets)) {
    throw new Error('Invalid vault bundle format');
  }
  return bundle;
}

/**
 * After account password reset: re-wrap vault key with the new password using the
 * recovery phrase (client-side only). Server never holds plaintext.
 */
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
