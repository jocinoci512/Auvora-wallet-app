import type { ChainNetwork } from '@auvora/database';

export const SIMULATOR_LEDGER = Symbol('SIMULATOR_LEDGER');

/**
 * Redis-backed state for the in-process chain simulators: balances, the
 * simulated block height counter, mempool membership, and watched addresses.
 */
export interface SimulatorLedgerPort {
  getBalance(chain: ChainNetwork, address: string): Promise<string>;
  credit(chain: ChainNetwork, address: string, amount: string): Promise<string>;
  debit(chain: ChainNetwork, address: string, amount: string): Promise<string>;
  getBlockHeight(chain: ChainNetwork): Promise<bigint>;
  advanceBlockHeight(chain: ChainNetwork, by?: bigint): Promise<bigint>;
  addToMempool(chain: ChainNetwork, txHash: string): Promise<void>;
  removeFromMempool(chain: ChainNetwork, txHash: string): Promise<void>;
  listMempool(chain: ChainNetwork): Promise<string[]>;
  watchAddress(chain: ChainNetwork, address: string): Promise<void>;
  isWatched(chain: ChainNetwork, address: string): Promise<boolean>;
}
