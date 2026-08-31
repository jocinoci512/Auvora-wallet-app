/**
 * Web chain support vs Android unified wallet (public data only).
 * Signing/broadcast gates are separate from address visibility.
 */

export type ChainSupportLevel = 'FULL WEB SUPPORT' | 'READ-ONLY' | 'PARTIAL' | 'NOT IMPLEMENTED';

export const WEB_CHAIN_PARITY: Record<
  'BITCOIN' | 'ETHEREUM' | 'BNB_SMART_CHAIN' | 'POLYGON' | 'SOLANA' | 'TRON',
  { level: ChainSupportLevel; notes: string }
> = {
  ETHEREUM: {
    level: 'FULL WEB SUPPORT',
    notes: "Client HD derive (m/44'/60'/0'/0/0) + backend registration + balances.",
  },
  BNB_SMART_CHAIN: {
    level: 'FULL WEB SUPPORT',
    notes: 'Same EVM path as Ethereum; shared address across EVM chains.',
  },
  POLYGON: {
    level: 'FULL WEB SUPPORT',
    notes: 'Same EVM path as Ethereum; shared address across EVM chains.',
  },
  BITCOIN: {
    level: 'PARTIAL',
    notes:
      "Android derives m/84'/1'/0'/0/0 (testnet). Web shows balances when watch/chain address is registered — no client derive yet.",
  },
  SOLANA: {
    level: 'PARTIAL',
    notes:
      "Android derives m/44'/501'/0'/0'. Web shows when registered on backend — no client derive or Solana signing on web yet.",
  },
  TRON: {
    level: 'PARTIAL',
    notes:
      "Android derives m/44'/195'/0'/0/0. Web shows when registered on backend — no Tron signing on web yet.",
  },
};

export function maskPublicAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}
