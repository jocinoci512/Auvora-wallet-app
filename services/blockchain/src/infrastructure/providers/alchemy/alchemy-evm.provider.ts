import type { ChainNetwork, FeePriority } from '@auvora/database';
import type { BlockchainProvider, ProviderTx } from '../../../domain';
import { validateAddressForChain } from '../../../domain';
import { generateEvmAddress } from '../address-crypto.util';
import { JsonRpcClient, type JsonRpcMetrics } from './json-rpc.client';

const ERC20_BALANCE_OF = '0x70a08231';

function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

function weiToEthString(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = wei % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
}

/**
 * Alchemy JSON-RPC provider for EVM chains (Ethereum, BNB Smart Chain, Polygon).
 */
export class AlchemyEvmProvider implements BlockchainProvider {
  private readonly client: JsonRpcClient;
  private readonly metrics: JsonRpcMetrics = {
    requests: 0,
    errors: 0,
    retries: 0,
    totalLatencyMs: 0,
  };

  constructor(
    private readonly chain: ChainNetwork,
    rpcUrl: string,
    private readonly nativeSymbol: string,
    timeoutMs = 12_000,
  ) {
    this.client = new JsonRpcClient(rpcUrl, {
      metrics: this.metrics,
      label: `${chain}-alchemy`,
      timeoutMs,
      maxRetries: 2,
    });
  }

  getChain(): ChainNetwork {
    return this.chain;
  }

  getRpcMetrics(): JsonRpcMetrics {
    return this.client.getMetrics();
  }

  getSafeEndpoint(): string {
    return this.client.getSafeEndpoint();
  }

  async createAddress(): Promise<{ address: string; metadata?: Record<string, unknown> }> {
    const generated = generateEvmAddress();
    return {
      address: generated.address,
      metadata: { publicKey: generated.publicKey, backend: 'alchemy' },
    };
  }

  validateAddress(address: string): boolean {
    return validateAddressForChain(this.chain, address);
  }

  async getBalance(address: string): Promise<string> {
    const weiHex = await this.client.call<string>('eth_getBalance', [address, 'latest']);
    return weiToEthString(hexToBigInt(weiHex));
  }

  /** ERC-20 / BEP-20 balance via balanceOf(address). */
  async getTokenBalance(tokenContract: string, holder: string): Promise<string> {
    const padded = holder.toLowerCase().replace(/^0x/, '').padStart(64, '0');
    const data = `${ERC20_BALANCE_OF}${padded}`;
    const result = await this.client.call<string>('eth_call', [
      { to: tokenContract, data },
      'latest',
    ]);
    return hexToBigInt(result || '0x0').toString();
  }

  async getBlockHeight(): Promise<bigint> {
    const hex = await this.client.call<string>('eth_blockNumber', []);
    return hexToBigInt(hex);
  }

  /** EIP-155 chain id from eth_chainId (hex → number string). */
  async getChainId(): Promise<string> {
    const hex = await this.client.call<string>('eth_chainId', []);
    return hexToBigInt(hex).toString();
  }

  async getGasPriceWei(): Promise<bigint> {
    const gasPriceHex = await this.client.call<string>('eth_gasPrice', []);
    return hexToBigInt(gasPriceHex);
  }

  /** eth_estimateGas for a simple transfer or arbitrary call object. */
  async estimateGas(tx: {
    from?: string;
    to?: string;
    value?: string;
    data?: string;
  }): Promise<bigint> {
    const hex = await this.client.call<string>('eth_estimateGas', [tx]);
    return hexToBigInt(hex);
  }

  /**
   * Alchemy Enhanced API — asset transfer history for an address.
   * Falls back to an empty list when the method is unavailable on the endpoint.
   */
  async getAssetTransfers(
    address: string,
    maxCount = 25,
  ): Promise<
    Array<{
      hash: string;
      from: string;
      to: string;
      value: number | null;
      asset: string | null;
      category: string;
      blockNum: string;
    }>
  > {
    try {
      const result = await this.client.call<{
        transfers?: Array<{
          hash: string;
          from: string;
          to: string;
          value: number | null;
          asset: string | null;
          category: string;
          blockNum: string;
        }>;
      }>('alchemy_getAssetTransfers', [
        {
          fromBlock: '0x0',
          toBlock: 'latest',
          fromAddress: address,
          category: ['external', 'erc20', 'erc721', 'erc1155', 'internal'],
          withMetadata: false,
          excludeZeroValue: true,
          maxCount: `0x${maxCount.toString(16)}`,
          order: 'desc',
        },
      ]);
      return result.transfers ?? [];
    } catch {
      return [];
    }
  }

  async getTransaction(txHash: string): Promise<ProviderTx | null> {
    const tx = await this.client.call<{
      hash: string;
      from?: string;
      to?: string;
      value?: string;
      blockNumber?: string | null;
    } | null>('eth_getTransactionByHash', [txHash]);
    if (!tx) {
      return null;
    }
    const receipt = await this.client.call<{
      status?: string;
      blockNumber?: string;
      confirmations?: string;
    } | null>('eth_getTransactionReceipt', [txHash]);
    const tip = await this.getBlockHeight();
    const blockNumber = tx.blockNumber ? hexToBigInt(tx.blockNumber) : undefined;
    const confirmations = blockNumber != null ? Number(tip - blockNumber + 1n) : 0;
    const failed = receipt?.status === '0x0';
    return {
      txHash: tx.hash,
      fromAddress: tx.from,
      toAddress: tx.to ?? undefined,
      amount: tx.value ? weiToEthString(hexToBigInt(tx.value)) : '0',
      confirmations: Math.max(0, confirmations),
      blockNumber,
      status: failed ? 'FAILED' : blockNumber != null ? 'CONFIRMED' : 'MEMPOOL',
    };
  }

  async broadcastTransaction(rawTxHex: string): Promise<{ txHash: string }> {
    const prefixed = rawTxHex.startsWith('0x') ? rawTxHex : `0x${rawTxHex}`;
    const txHash = await this.client.call<string>('eth_sendRawTransaction', [prefixed]);
    return { txHash };
  }

  async estimateFee(priority: FeePriority): Promise<{ amount: string; unit: string }> {
    const gasPriceHex = await this.client.call<string>('eth_gasPrice', []);
    const gasPrice = hexToBigInt(gasPriceHex);
    const multipliers: Record<FeePriority, number> = {
      SLOW: 0.9,
      STANDARD: 1,
      FAST: 1.15,
      PRIORITY: 1.25,
    };
    const adjusted = BigInt(Math.floor(Number(gasPrice) * multipliers[priority]));
    // Approximate cost for 21_000 gas transfer in native units
    const feeWei = adjusted * 21_000n;
    return { amount: weiToEthString(feeWei), unit: this.nativeSymbol };
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

  async watchAddress(_address: string): Promise<void> {
    // Subscriptions are optional; health monitor + sync cover Phase 17.
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      const [height, chainId] = await Promise.all([this.getBlockHeight(), this.getChainId()]);
      return {
        healthy: true,
        latencyMs: Date.now() - start,
        message: `alchemy_evm_ok tip=${height.toString()} chainId=${chainId}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'alchemy_evm_error',
      };
    }
  }
}
