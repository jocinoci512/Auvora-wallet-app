export const BLOCKCHAIN_HTTP_CLIENT = Symbol('BLOCKCHAIN_HTTP_CLIENT');

/**
 * Optional HTTP client interface for talking to the Phase 4 blockchain service
 * (`services/blockchain`), the system of record for chain addresses, balances,
 * transactions, and network status.
 *
 * Wallet Core does not currently depend on this port — `WalletService.createWallet`
 * only issues an internal ledger wallet and never needs on-chain address state.
 * It is registered in the DI graph so future wallet features (e.g. attaching a
 * chain address to a wallet, or validating a withdrawal destination) can inject
 * it without introducing a new integration seam.
 */
export interface BlockchainHttpClientPort {
  /**
   * Validate an address for a given chain via the blockchain service when configured.
   * When `BLOCKCHAIN_SERVICE_URL` is unset, applies local format validation and
   * rejects unknown chains (fail-closed).
   */
  validateAddress(chain: string, address: string): Promise<boolean>;
}
