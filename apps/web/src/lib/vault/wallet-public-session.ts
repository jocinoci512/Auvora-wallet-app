/**
 * Session-scoped public wallet state after vault unlock.
 * Stores public addresses only — never mnemonic / private keys outside device vault.
 */

import { createApiClient } from '../api-client';
import { deriveEvmPublicAccounts, type DerivedPublicAccount } from './derive-public-accounts';
import { readDeviceVault, type DeviceVaultSnapshot } from './vault-sync';

const PUBLIC_SESSION_KEY = 'auvora_wallet_public_session_v1';

export type WalletPublicSession = {
  ownerUserId: string;
  initializedAt: string;
  ethereumAddress: string;
  accounts: DerivedPublicAccount[];
  registered: boolean;
};

export function readWalletPublicSession(): WalletPublicSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PUBLIC_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WalletPublicSession;
  } catch {
    return null;
  }
}

export function writeWalletPublicSession(session: WalletPublicSession): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PUBLIC_SESSION_KEY, JSON.stringify(session));
}

export function clearWalletPublicSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(PUBLIC_SESSION_KEY);
}

export function hasInitializedWebWallet(): boolean {
  const session = readWalletPublicSession();
  if (session?.ethereumAddress) return true;
  const vault = readDeviceVault();
  return Boolean(vault?.bundle.wallets.length);
}

/** Build public session from an unlocked device vault snapshot (client-only). */
export function initializePublicSessionFromVault(vault: DeviceVaultSnapshot): WalletPublicSession {
  const primary = vault.bundle.wallets[0];
  if (!primary?.mnemonic) {
    throw new Error('Unlocked vault has no wallet material.');
  }
  const accounts = deriveEvmPublicAccounts(primary.mnemonic, 0);
  const ethereumAddress = accounts[0]!.address;
  const session: WalletPublicSession = {
    ownerUserId: vault.ownerUserId,
    initializedAt: new Date().toISOString(),
    ethereumAddress,
    accounts,
    registered: false,
  };
  writeWalletPublicSession(session);
  return session;
}

/**
 * Idempotent public-address registration with wallet-engine (never sends secrets).
 * Canonical entry used after vault restore, Web unlock, and dashboard load.
 */
export async function ensurePublicWalletsRegistered(
  session?: WalletPublicSession | null,
): Promise<WalletPublicSession | null> {
  const current = session ?? readWalletPublicSession();
  if (!current) return null;
  const client = createApiClient({ timeoutMs: 30_000 });
  let ok = 0;
  let attempted = 0;
  for (const account of current.accounts) {
    attempted += 1;
    const body = {
      assetCode: account.assetCode,
      address: account.address,
      alias: `auvora-public-testnet-${account.assetCode.toLowerCase()}`,
      label: `${account.network} · Web`,
      networkEnv: 'testnet' as const,
      clientPlatform: 'web',
      selfCustody: true,
    };
    const encoded = JSON.stringify(body).toLowerCase();
    if (
      encoded.includes('mnemonic') ||
      encoded.includes('private') ||
      encoded.includes('seed') ||
      encoded.includes('password')
    ) {
      continue;
    }
    try {
      await client.importPublicWalletAddress(body);
      ok += 1;
    } catch {
      /* keep trying other chains; local wallet remains usable */
    }
  }
  const next = { ...current, registered: ok > 0 && ok === attempted };
  writeWalletPublicSession(next);
  return next;
}

/** @deprecated Use [ensurePublicWalletsRegistered]. */
export const syncPublicAddressesToBackend = ensurePublicWalletsRegistered;

/** Ensure public session exists when device vault is unlocked. */
export function ensurePublicSessionFromDeviceVault(): WalletPublicSession | null {
  const existing = readWalletPublicSession();
  if (existing?.ethereumAddress) return existing;
  const vault = readDeviceVault();
  if (!vault?.bundle.wallets.length) return null;
  return initializePublicSessionFromVault(vault);
}
