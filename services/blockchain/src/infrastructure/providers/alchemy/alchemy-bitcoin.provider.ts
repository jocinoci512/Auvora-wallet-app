import { ChainNetwork, type FeePriority } from '@auvora/database';
import type { BlockchainProvider, ProviderTx } from '../../../domain';
import { validateAddressForChain } from '../../../domain';
import { generateBase58CheckAddress } from '../address-crypto.util';
import { JsonRpcClient, type JsonRpcMetrics } from './json-rpc.client';

/**
 * Alchemy Bitcoin JSON-RPC provider.
 * Balance uses scantxoutset (descriptor) when available; otherwise returns '0' with healthy tip height.
 */
export class AlchemyBitcoinProvider implements BlockchainProvider {
  private readonly metrics: JsonRpcMetrics = {
    requests: 0,
    errors: 0,
    retries: 0,
    totalLatencyMs: 0,
  };
  private readonly client: JsonRpcClient;

  constructor(rpcUrl: string, timeoutMs = 20_000) {
    this.client = new JsonRpcClient(rpcUrl, {
      metrics: this.metrics,
      label: 'BITCOIN-alchemy',
      timeoutMs,
      maxRetries: 2,
    });
  }

  getChain(): ChainNetwork {
    return ChainNetwork.BITCOIN;
  }

  getRpcMetrics(): JsonRpcMetrics {
    return this.client.getMetrics();
  }

  getSafeEndpoint(): string {
    return this.client.getSafeEndpoint();
  }

  async createAddress(): Promise<{ address: string; metadata?: Record<string, unknown> }> {
    const generated = generateBase58CheckAddress(0x00);
    return { address: generated.address, metadata: { publicKey: generated.publicKey, backend: 'alchemy' } };
  }

  validateAddress(address: string): boolean {
    return validateAddressForChain(ChainNetwork.BITCOIN, address);
  }

  async getBalance(address: string): Promise<string> {
    try {
      const result = await this.client.call<{ total_amount?: number }>('scantxoutset', [
        'start',
        [`addr(${address})`],
      ]);
      return String(result.total_amount ?? 0);
    } catch {
      // Indexer may be unavailable on some Alchemy Bitcoin tiers — do not fail the provider.
      return '0';
    }
  }

  async getUtxos(address: string): Promise<Array<{ txid: string; vout: number; amount: number }>> {
    try {
      const result = await this.client.call<{
        unspents?: Array<{ txid: string; vout: number; amount: number }>;
      }>('scantxoutset', ['start', [`addr(${address})`]]);
      return result.unspents ?? [];
    } catch {
      return [];
    }
  }

  async getBlockHeight(): Promise<bigint> {
    const height = await this.client.call<number>('getblockcount', []);
    return BigInt(height);
  }

  async getTransaction(txHash: string): Promise<ProviderTx | null> {
    try {
      const tx = await this.client.call<{
        txid: string;
        confirmations?: number;
        blockhash?: string;
      }>('getrawtransaction', [txHash, true]);
      return {
        txHash: tx.txid,
        amount: '0',
        confirmations: tx.confirmations ?? 0,
        status: (tx.confirmations ?? 0) > 0 ? 'CONFIRMED' : 'MEMPOOL',
      };
    } catch {
      return null;
    }
  }

  async broadcastTransaction(rawTxHex: string): Promise<{ txHash: string }> {
    const txHash = await this.client.call<string>('sendrawtransaction', [rawTxHex]);
    return { txHash };
  }

  async estimateFee(priority: FeePriority): Promise<{ amount: string; unit: string }> {
    const confTarget: Record<FeePriority, number> = {
      SLOW: 6,
      STANDARD: 3,
      FAST: 2,
      PRIORITY: 1,
    };
    try {
      const result = await this.client.call<{ feerate?: number }>('estimatesmartfee', [confTarget[priority]]);
      const btcPerKb = result.feerate ?? 0.00001;
      return { amount: btcPerKb.toFixed(8), unit: 'BTC/kB' };
    } catch {
      return { amount: '0.00001000', unit: 'BTC/kB' };
    }
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

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      await this.getBlockHeight();
      return { healthy: true, latencyMs: Date.now() - start, message: 'alchemy_bitcoin_ok' };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'alchemy_bitcoin_error',
      };
    }
  }
}
