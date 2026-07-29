import { ChainNetwork, type FeePriority } from '@auvora/database';
import type { BlockchainProvider, ProviderTx } from '../../../domain';
import { validateAddressForChain } from '../../../domain';
import { generateSolanaAddress } from '../address-crypto.util';
import { JsonRpcClient, type JsonRpcMetrics } from './json-rpc.client';

/**
 * Alchemy Solana JSON-RPC provider.
 */
export class AlchemySolanaProvider implements BlockchainProvider {
  private readonly metrics: JsonRpcMetrics = {
    requests: 0,
    errors: 0,
    retries: 0,
    totalLatencyMs: 0,
  };
  private readonly client: JsonRpcClient;

  constructor(rpcUrl: string, timeoutMs = 15_000) {
    this.client = new JsonRpcClient(rpcUrl, {
      metrics: this.metrics,
      label: 'SOLANA-alchemy',
      timeoutMs,
      maxRetries: 2,
    });
  }

  getChain(): ChainNetwork {
    return ChainNetwork.SOLANA;
  }

  getRpcMetrics(): JsonRpcMetrics {
    return this.client.getMetrics();
  }

  getSafeEndpoint(): string {
    return this.client.getSafeEndpoint();
  }

  async createAddress(): Promise<{ address: string; metadata?: Record<string, unknown> }> {
    const generated = generateSolanaAddress();
    return {
      address: generated.address,
      metadata: { publicKey: generated.publicKey, backend: 'alchemy' },
    };
  }

  validateAddress(address: string): boolean {
    return validateAddressForChain(ChainNetwork.SOLANA, address);
  }

  async getBalance(address: string): Promise<string> {
    const result = await this.client.call<{ value: number }>('getBalance', [address]);
    // lamports → SOL
    return (result.value / 1_000_000_000).toFixed(9).replace(/0+$/, '').replace(/\.$/, '') || '0';
  }

  async getTokenBalance(mint: string, owner: string): Promise<string> {
    const result = await this.client.call<{
      value: Array<{
        account: { data: { parsed?: { info?: { tokenAmount?: { amount?: string } } } } };
      }>;
    }>('getTokenAccountsByOwner', [owner, { mint }, { encoding: 'jsonParsed' }]);
    const amount = result.value[0]?.account?.data?.parsed?.info?.tokenAmount?.amount;
    return amount ?? '0';
  }

  async getBlockHeight(): Promise<bigint> {
    const slot = await this.client.call<number>('getSlot', []);
    return BigInt(slot);
  }

  async getRecentBlockhash(): Promise<string> {
    const result = await this.client.call<{ value: { blockhash: string } }>(
      'getLatestBlockhash',
      [],
    );
    return result.value.blockhash;
  }

  /** Signature confirmation status (Alchemy / Solana JSON-RPC). */
  async getSignatureStatuses(
    signatures: string[],
  ): Promise<Array<{ confirmationStatus?: string; err?: unknown; slot?: number } | null>> {
    const result = await this.client.call<{
      value: Array<{ confirmationStatus?: string; err?: unknown; slot?: number } | null>;
    }>('getSignatureStatuses', [signatures, { searchTransactionHistory: true }]);
    return result.value ?? [];
  }

  async getTransaction(txHash: string): Promise<ProviderTx | null> {
    const tx = await this.client.call<{
      slot?: number;
      meta?: { err?: unknown; fee?: number };
      transaction?: { message?: { accountKeys?: string[] } };
    } | null>('getTransaction', [txHash, { encoding: 'json', maxSupportedTransactionVersion: 0 }]);
    if (!tx) {
      return null;
    }
    const tip = await this.getBlockHeight();
    const slot = tx.slot != null ? BigInt(tx.slot) : undefined;
    const confirmations = slot != null ? Number(tip - slot + 1n) : 0;
    return {
      txHash,
      amount: '0',
      confirmations: Math.max(0, confirmations),
      blockNumber: slot,
      status: tx.meta?.err ? 'FAILED' : slot != null ? 'CONFIRMED' : 'PENDING',
    };
  }

  async broadcastTransaction(rawTxHex: string): Promise<{ txHash: string }> {
    // Solana expects base64 wire format for sendTransaction
    const signature = await this.client.call<string>('sendTransaction', [
      rawTxHex,
      { encoding: 'base64', skipPreflight: false },
    ]);
    return { txHash: signature };
  }

  async estimateFee(priority: FeePriority): Promise<{ amount: string; unit: string }> {
    const multipliers: Record<FeePriority, number> = {
      SLOW: 1,
      STANDARD: 1,
      FAST: 1.1,
      PRIORITY: 1.2,
    };
    const base = 0.000005;
    return { amount: (base * multipliers[priority]).toFixed(9), unit: 'SOL' };
  }

  async getNetworkStatus(): Promise<{ healthy: boolean; latencyMs: number; blockHeight: bigint }> {
    const start = Date.now();
    const blockHeight = await this.getBlockHeight();
    return { healthy: true, latencyMs: Date.now() - start, blockHeight };
  }

  async getConfirmations(txHash: string): Promise<number> {
    const tx = await this.getTransaction(txHash);
    return tx?.confirmations ?? 0;
  }

  async watchAddress(_address: string): Promise<void> {}

  /**
   * Alchemy DAS (Digital Asset Standard) NFT helpers are not wired in Phase 25.
   * Callers must use the NFT service ports instead of inventing a parallel RPC path.
   */
  async getDasAsset(_assetId: string): Promise<never> {
    throw new Error(
      'Alchemy DAS getAsset is not enabled on BlockchainProvider — use NFT service abstractions',
    );
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      const [blockhash, slot] = await Promise.all([
        this.getRecentBlockhash(),
        this.getBlockHeight(),
      ]);
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        message: `alchemy_solana_ok slot=${slot.toString()} blockhash=${blockhash.slice(0, 8)}…`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'alchemy_solana_error',
      };
    }
  }
}
