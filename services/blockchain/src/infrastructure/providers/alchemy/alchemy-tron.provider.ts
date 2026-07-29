import { ChainNetwork, type FeePriority } from '@auvora/database';
import type { BlockchainProvider, ProviderTx } from '../../../domain';
import { validateAddressForChain } from '../../../domain';
import { generateTronAddress } from '../address-crypto.util';
import { JsonRpcClient, type JsonRpcMetrics } from './json-rpc.client';

/**
 * Alchemy / full-node compatible Tron provider.
 * Uses JSON-RPC when available; falls back to Tron HTTP wallet endpoints on the same base URL.
 */
export class AlchemyTronProvider implements BlockchainProvider {
  private readonly metrics: JsonRpcMetrics = {
    requests: 0,
    errors: 0,
    retries: 0,
    totalLatencyMs: 0,
  };
  private readonly client: JsonRpcClient;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(rpcUrl: string, timeoutMs = 15_000) {
    this.baseUrl = rpcUrl.replace(/\/$/, '');
    this.timeoutMs = timeoutMs;
    this.client = new JsonRpcClient(rpcUrl, {
      metrics: this.metrics,
      label: 'TRON-alchemy',
      timeoutMs,
      maxRetries: 2,
    });
  }

  getChain(): ChainNetwork {
    return ChainNetwork.TRON;
  }

  getRpcMetrics(): JsonRpcMetrics {
    return this.client.getMetrics();
  }

  getSafeEndpoint(): string {
    return this.client.getSafeEndpoint();
  }

  async createAddress(): Promise<{ address: string; metadata?: Record<string, unknown> }> {
    const generated = generateTronAddress();
    return {
      address: generated.address,
      metadata: { publicKey: generated.publicKey, backend: 'alchemy' },
    };
  }

  validateAddress(address: string): boolean {
    return validateAddressForChain(ChainNetwork.TRON, address);
  }

  async getBalance(address: string): Promise<string> {
    try {
      const sun = await this.client.call<number | string>('eth_getBalance', [address, 'latest']);
      const value = typeof sun === 'string' ? BigInt(sun) : BigInt(sun);
      return (Number(value) / 1_000_000).toString();
    } catch {
      const account = await this.httpPost<{ balance?: number }>('/wallet/getaccount', { address });
      const sun = BigInt(account.balance ?? 0);
      return (Number(sun) / 1_000_000).toString();
    }
  }

  async getTokenBalance(contractAddress: string, holder: string): Promise<string> {
    const result = await this.httpPost<{ constant_result?: string[] }>(
      '/wallet/triggerconstantcontract',
      {
        owner_address: holder,
        contract_address: contractAddress,
        function_selector: 'balanceOf(address)',
        parameter: holder,
        visible: true,
      },
    );
    const hex = result.constant_result?.[0];
    return hex ? BigInt(`0x${hex}`).toString() : '0';
  }

  async getBlockHeight(): Promise<bigint> {
    try {
      const hex = await this.client.call<string>('eth_blockNumber', []);
      return BigInt(hex);
    } catch {
      const block = await this.httpPost<{ block_header?: { raw_data?: { number?: number } } }>(
        '/wallet/getnowblock',
        {},
      );
      return BigInt(block.block_header?.raw_data?.number ?? 0);
    }
  }

  async getTransaction(txHash: string): Promise<ProviderTx | null> {
    try {
      const info = await this.httpPost<{
        id?: string;
        blockNumber?: number;
        receipt?: { result?: string };
      }>('/wallet/gettransactioninfobyid', { value: txHash });
      if (!info?.id) {
        return null;
      }
      const tip = await this.getBlockHeight();
      const blockNumber = info.blockNumber != null ? BigInt(info.blockNumber) : undefined;
      const confirmations = blockNumber != null ? Number(tip - blockNumber + 1n) : 0;
      return {
        txHash: info.id,
        amount: '0',
        confirmations: Math.max(0, confirmations),
        blockNumber,
        status:
          info.receipt?.result === 'FAILED'
            ? 'FAILED'
            : blockNumber != null
              ? 'CONFIRMED'
              : 'PENDING',
      };
    } catch {
      return null;
    }
  }

  async broadcastTransaction(rawTxHex: string): Promise<{ txHash: string }> {
    try {
      const txHash = await this.client.call<string>('eth_sendRawTransaction', [
        rawTxHex.startsWith('0x') ? rawTxHex : `0x${rawTxHex}`,
      ]);
      return { txHash };
    } catch {
      const result = await this.httpPost<{ txid?: string }>('/wallet/broadcasthex', {
        transaction: rawTxHex,
      });
      if (!result.txid) {
        throw new Error('Tron broadcast failed');
      }
      return { txHash: result.txid };
    }
  }

  async estimateFee(priority: FeePriority): Promise<{ amount: string; unit: string }> {
    const multipliers: Record<FeePriority, number> = {
      SLOW: 0.8,
      STANDARD: 1,
      FAST: 1.15,
      PRIORITY: 1.3,
    };
    return { amount: (1 * multipliers[priority]).toFixed(2), unit: 'TRX' };
  }

  /** Energy / bandwidth resource estimate for a TRX transfer (best-effort). */
  async estimateResources(
    address: string,
  ): Promise<{ energy: number; bandwidth: number; freeNetLimit: number }> {
    try {
      const resources = await this.httpPost<{
        EnergyLimit?: number;
        EnergyUsed?: number;
        freeNetLimit?: number;
        freeNetUsed?: number;
        NetLimit?: number;
        NetUsed?: number;
      }>('/wallet/getaccountresource', { address, visible: true });
      const energy = Math.max(0, (resources.EnergyLimit ?? 0) - (resources.EnergyUsed ?? 0));
      const bandwidth = Math.max(
        0,
        (resources.freeNetLimit ?? 0) -
          (resources.freeNetUsed ?? 0) +
          ((resources.NetLimit ?? 0) - (resources.NetUsed ?? 0)),
      );
      return { energy, bandwidth, freeNetLimit: resources.freeNetLimit ?? 0 };
    } catch {
      return { energy: 0, bandwidth: 0, freeNetLimit: 0 };
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
      const tip = await this.getBlockHeight();
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        message: `alchemy_tron_ok tip=${tip.toString()}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'alchemy_tron_error',
      };
    }
  }

  private async httpPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const started = Date.now();
    this.metrics.requests += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Tron HTTP ${response.status}`);
      }
      this.metrics.totalLatencyMs += Date.now() - started;
      this.metrics.lastSuccessAt = new Date().toISOString();
      return (await response.json()) as T;
    } catch (error) {
      this.metrics.errors += 1;
      this.metrics.totalLatencyMs += Date.now() - started;
      this.metrics.lastErrorAt = new Date().toISOString();
      this.metrics.lastErrorMessage =
        error instanceof Error ? error.message.slice(0, 200) : 'tron_http_error';
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
