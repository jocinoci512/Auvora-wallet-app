/**
 * Client helpers for GET/PUT `/api/v1/vault` (encrypted envelope only).
 */

import type { AuvoraClient, EncryptedVaultBlob, UpsertEncryptedVaultInput } from '@auvora/sdk';
import { createApiClient } from '../api-client';
import { getOrCreateDeviceId } from '../auth/device';
import { getCachedUser } from '../auth/session';
import {
  decryptVaultBundle,
  encryptVaultBundle,
  type EncryptedVaultEnvelope,
  type VaultPlaintextBundle,
  type VaultUploadPayload,
} from './browser-envelope';

const DEVICE_VAULT_KEY = 'auvora_device_vault_v1';

export type DeviceVaultSnapshot = {
  ownerUserId: string;
  restoredAt: string;
  bundle: VaultPlaintextBundle;
};

export function readDeviceVault(): DeviceVaultSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DEVICE_VAULT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DeviceVaultSnapshot;
  } catch {
    return null;
  }
}

export function writeDeviceVault(snapshot: DeviceVaultSnapshot): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(DEVICE_VAULT_KEY, JSON.stringify(snapshot));
}

export function clearDeviceVault(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DEVICE_VAULT_KEY);
  try {
    // Lazy import avoids circular deps with wallet-public-session.
    sessionStorage.removeItem('auvora_wallet_public_session_v1');
  } catch {
    /* ignore */
  }
}

export async function getEncryptedVault(client?: AuvoraClient): Promise<EncryptedVaultBlob | null> {
  const c = client ?? createApiClient({ timeoutMs: 45_000 });
  return c.getEncryptedVault();
}

export async function upsertEncryptedVault(
  payload: VaultUploadPayload,
  client?: AuvoraClient,
): Promise<EncryptedVaultBlob> {
  const c = client ?? createApiClient({ timeoutMs: 45_000 });
  const input: UpsertEncryptedVaultInput = {
    ...payload,
    deviceId: getOrCreateDeviceId(),
  };
  return c.upsertEncryptedVault(input);
}

export async function uploadVaultBundle(args: {
  password: string;
  recoveryPhrase: string;
  bundle: VaultPlaintextBundle;
  client?: AuvoraClient;
}): Promise<EncryptedVaultBlob> {
  const user = getCachedUser();
  if (!user?.id) throw new Error('Sign in before uploading an encrypted vault.');
  const client = args.client ?? createApiClient({ timeoutMs: 45_000 });
  const existing = await client.getEncryptedVault();
  const epoch = (existing?.epoch ?? 0) + 1;
  const payload = await encryptVaultBundle({
    ownerUserId: user.id,
    epoch,
    password: args.password,
    recoveryPhrase: args.recoveryPhrase,
    bundle: args.bundle,
  });
  const stored = await upsertEncryptedVault(payload, client);
  writeDeviceVault({
    ownerUserId: user.id,
    restoredAt: new Date().toISOString(),
    bundle: args.bundle,
  });
  return stored;
}

export async function restoreVaultFromCloud(args: {
  password: string;
  recoveryPhrase?: string;
  client?: AuvoraClient;
}): Promise<VaultPlaintextBundle> {
  const user = getCachedUser();
  if (!user?.id) throw new Error('Sign in before restoring an encrypted vault.');
  const client = args.client ?? createApiClient({ timeoutMs: 45_000 });
  const remote = await client.getEncryptedVault();
  if (!remote) throw new Error('No encrypted vault is stored for this account yet.');

  const envelope: EncryptedVaultEnvelope = {
    algorithmId: remote.algorithmId as EncryptedVaultEnvelope['algorithmId'],
    version: 1,
    kdfSalt: remote.kdfSalt,
    kdfParams: remote.kdfParams as EncryptedVaultEnvelope['kdfParams'],
    recoveryKdfSalt: remote.recoveryKdfSalt,
    recoveryKdfParams: remote.recoveryKdfParams as EncryptedVaultEnvelope['kdfParams'],
    wrappedVaultKey: remote.wrappedVaultKey,
    wrappedVaultKeyRecovery: remote.wrappedVaultKeyRecovery,
    ciphertext: remote.ciphertext,
    aad: remote.aad,
  };

  const bundle = await decryptVaultBundle({
    ownerUserId: user.id,
    envelope,
    epoch: remote.epoch,
    password: args.password,
    recoveryPhrase: args.recoveryPhrase,
  });

  writeDeviceVault({
    ownerUserId: user.id,
    restoredAt: new Date().toISOString(),
    bundle,
  });

  // Initialize public Web wallet state from the unlocked vault (addresses only).
  const { initializePublicSessionFromVault, ensurePublicWalletsRegistered } =
    await import('./wallet-public-session');
  const session = initializePublicSessionFromVault({
    ownerUserId: user.id,
    restoredAt: new Date().toISOString(),
    bundle,
  });
  void ensurePublicWalletsRegistered(session);

  return bundle;
}
