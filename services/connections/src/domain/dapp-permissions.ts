import type { ChainNetwork } from '@auvora/database';
import { ConnectionsValidationError } from './errors';

/** Canonical dApp permission set used by Auvora Web3 Connectivity. */
export const DAPP_PERMISSIONS = [
  'VIEW_ADDRESSES',
  'VIEW_BALANCES',
  'REQUEST_SIGNATURES',
  'REQUEST_TRANSACTIONS',
  'NETWORK_SWITCH',
  'SESSION_MANAGE',
] as const;

export type DappPermission = (typeof DAPP_PERMISSIONS)[number];

export const DAPP_PERMISSION_LABELS: Record<DappPermission, string> = {
  VIEW_ADDRESSES: 'View addresses',
  VIEW_BALANCES: 'View balances',
  REQUEST_SIGNATURES: 'Request signatures',
  REQUEST_TRANSACTIONS: 'Request transactions',
  NETWORK_SWITCH: 'Network switching',
  SESSION_MANAGE: 'Session management',
};

export const WEB3_SUPPORTED_NETWORKS = [
  'ETHEREUM',
  'BNB_SMART_CHAIN',
  'SOLANA',
  'TRON',
  'BITCOIN',
] as const satisfies readonly ChainNetwork[];

/** Bitcoin is read-only for dApp signing / transaction requests. */
export function isReadOnlyNetwork(network: ChainNetwork): boolean {
  return network === 'BITCOIN';
}

export function normalizeOrigin(input: string): string {
  try {
    const url = new URL(input.includes('://') ? input : `https://${input}`);
    return url.origin.toLowerCase();
  } catch {
    throw new ConnectionsValidationError(`Invalid dApp origin: ${input}`);
  }
}

export function assertSupportedNetworks(networks: ChainNetwork[]): void {
  for (const network of networks) {
    if (!(WEB3_SUPPORTED_NETWORKS as readonly string[]).includes(network)) {
      throw new ConnectionsValidationError(`Unsupported Web3 network: ${network}`, { network });
    }
  }
}

export function assertValidPermissions(permissions: string[]): DappPermission[] {
  const unique = [...new Set(permissions)];
  for (const permission of unique) {
    if (!(DAPP_PERMISSIONS as readonly string[]).includes(permission)) {
      throw new ConnectionsValidationError(`Unsupported dApp permission: ${permission}`, {
        permission,
      });
    }
  }
  return unique as DappPermission[];
}
