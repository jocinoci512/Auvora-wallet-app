import type { ChainNetwork } from '@auvora/database';

/** Product-supported chains for public address registration (Alpha). */
export const AUVORA_SUPPORTED_PUBLIC_NETWORKS = [
  'BITCOIN',
  'ETHEREUM',
  'SOLANA',
  'BNB_SMART_CHAIN',
  'TRON',
  'POLYGON',
] as const satisfies readonly ChainNetwork[];

export type AuvoraSupportedPublicNetwork = (typeof AUVORA_SUPPORTED_PUBLIC_NETWORKS)[number];

export function isSupportedPublicNetwork(network: string): network is AuvoraSupportedPublicNetwork {
  return (AUVORA_SUPPORTED_PUBLIC_NETWORKS as readonly string[]).includes(network);
}

/** EVM chains where personal_sign ownership challenges are production-capable. */
export const EVM_OWNERSHIP_NETWORKS = new Set<string>(['ETHEREUM', 'BNB_SMART_CHAIN', 'POLYGON']);

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const BTC_BECH32_RE = /^(bc1)[a-z0-9]{25,87}$/i;
const BTC_BASE58_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{24,34}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const TRON_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function validatePublicAddressFormat(network: ChainNetwork, address: string): boolean {
  const a = address.trim();
  switch (network) {
    case 'ETHEREUM':
    case 'BNB_SMART_CHAIN':
    case 'POLYGON':
      return EVM_ADDRESS_RE.test(a);
    case 'BITCOIN':
      return BTC_BECH32_RE.test(a) || BTC_BASE58_RE.test(a);
    case 'SOLANA':
      return SOL_RE.test(a) && !a.startsWith('0x');
    case 'TRON':
      return TRON_RE.test(a);
    default:
      return false;
  }
}
