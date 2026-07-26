export const WALLET_LEDGER = Symbol('WALLET_LEDGER');

export interface WalletLedgerCreditInput {
  walletId: string;
  amount: string;
  /** Must match wallet.ownerUserId — enforced by wallet internal ledger. */
  expectedOwnerUserId: string;
  description?: string;
  metadata?: Record<string, unknown>;
  transactionType?: string;
}

export interface WalletLedgerDebitInput {
  walletId: string;
  amount: string;
  expectedOwnerUserId: string;
  description?: string;
  metadata?: Record<string, unknown>;
  transactionType?: string;
}

export interface WalletLedgerTransferInput {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  /** Owner of the source (debit) wallet. */
  expectedOwnerUserId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface WalletLedgerResult {
  success: boolean;
  transactionId?: string;
  message?: string;
}

export interface WalletOwnerLookup {
  id: string;
  ownerUserId: string;
}

/**
 * Outbound port to the Wallet Core service's internal ledger HTTP API.
 * Wallet Core must never depend on payment providers; all interaction is
 * one-directional over HTTP from Payments -> Wallet.
 */
export interface WalletLedgerPort {
  credit(input: WalletLedgerCreditInput): Promise<WalletLedgerResult>;
  debit(input: WalletLedgerDebitInput): Promise<WalletLedgerResult>;
  transfer(input: WalletLedgerTransferInput): Promise<WalletLedgerResult>;
  getWalletOwner(walletId: string): Promise<WalletOwnerLookup | null>;
}
