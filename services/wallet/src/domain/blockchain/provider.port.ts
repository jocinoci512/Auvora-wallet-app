import type { AssetStandard, ChainNetwork } from '@auvora/database';

export const BLOCKCHAIN_PROVIDER = Symbol('BLOCKCHAIN_PROVIDER');

/**
 * Local, in-process chain metadata for Wallet Core (Phase 3).
 *
 * As of Phase 4, the **blockchain service** (`services/blockchain`) is the system of
 * record for chain addresses, balances, transactions, blocks, and provider/network
 * health — see `docs/ARCHITECTURE.md` and the README "Phase 4 — Blockchain" section.
 * Real chain operations (address issuance, balance/transaction lookups, fee
 * estimation, confirmation tracking) go through the blockchain service over HTTP
 * (see `infrastructure/blockchain/blockchain-client.port.ts`), proxied by the
 * gateway at `/api/v1/blockchain` and `/api/v1/admin/blockchain`.
 *
 * These `BlockchainProviderPort` implementations remain intentionally minimal
 * stubs: they only answer local, static questions — "which chain is this?" and
 * "which asset standards does this chain support?" (e.g. for wallet creation
 * validation) — plus an optional address-format regex check. They do not call
 * out to any network and must not be extended with live chain logic; that
 * belongs in the blockchain service.
 */
export interface BlockchainProviderPort {
  getChain(): ChainNetwork;
  validateAddress?(address: string): boolean;
  supportsAsset(standard: AssetStandard): boolean;
}
