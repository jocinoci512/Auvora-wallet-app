import { createHash, randomBytes } from 'node:crypto';
import type { ChainNetwork, FeePriority, PrismaService } from '@auvora/database';
import type { NetworkConfigRepositoryPort } from '../../application/ports/network-config-repository.port';
import type { SimulatorLedgerPort } from '../../application/ports/simulator-ledger.port';
import type { BlockchainProvider, ProviderTx, ProviderTxStatus } from '../../domain';
import { DEFAULT_FEE_MULTIPLIERS, extractFeeMetadata } from './fee-schedule.util';

const CHAIN_TX_STATUS_MAP: Record<string, ProviderTxStatus> = {
  MEMPOOL: 'MEMPOOL',
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
  REJECTED: 'FAILED',
  CANCELLED: 'FAILED',
  REORGED: 'FAILED',
};

/**
 * Shared behavior for every simulated chain: each concrete provider only
 * supplies address generation/validation and its native fee defaults. Real
 * network integrations would instead route these calls through the RPC URL
 * configured on `BlockchainNetworkConfig.rpcUrl`, resolved per chain.
 */
export abstract class BaseSimulatorProvider implements BlockchainProvider {
  protected constructor(
    protected readonly prisma: PrismaService,
    protected readonly networkConfig: NetworkConfigRepositoryPort,
    protected readonly ledger: SimulatorLedgerPort,
    private readonly chain: ChainNetwork,
  ) {}

  getChain(): ChainNetwork {
    return this.chain;
  }

  abstract createAddress(): Promise<{ address: string; metadata?: Record<string, unknown> }>;
  abstract validateAddress(address: string): boolean;
  protected abstract defaultFee(): { base: string; unit: string };

  async getBalance(address: string): Promise<string> {
    return this.ledger.getBalance(this.chain, address);
  }

  async getBlockHeight(): Promise<bigint> {
    return this.ledger.getBlockHeight(this.chain);
  }

  async getTransaction(txHash: string): Promise<ProviderTx | null> {
    const record = await this.prisma.chainTransaction.findUnique({
      where: { chain_txHash: { chain: this.chain, txHash } },
    });
    if (!record) {
      return null;
    }
    return {
      txHash: record.txHash,
      fromAddress: record.fromAddress ?? undefined,
      toAddress: record.toAddress ?? undefined,
      amount: record.amount.toString(),
      confirmations: record.confirmations,
      blockNumber: record.blockNumber ?? undefined,
      status: CHAIN_TX_STATUS_MAP[record.status] ?? 'PENDING',
    };
  }

  async broadcastTransaction(rawTxHex: string): Promise<{ txHash: string }> {
    const nonce = randomBytes(16).toString('hex');
    const txHash = createHash('sha256').update(`${this.chain}:${rawTxHex}:${nonce}`).digest('hex');
    await this.ledger.addToMempool(this.chain, txHash);
    return { txHash };
  }

  async estimateFee(priority: FeePriority): Promise<{ amount: string; unit: string }> {
    const config = await this.networkConfig.findByChain(this.chain);
    const feeMeta = extractFeeMetadata(config?.metadata);
    const defaults = this.defaultFee();
    const base = feeMeta?.base ?? defaults.base;
    const unit = feeMeta?.unit ?? defaults.unit;
    const multiplier = feeMeta?.multipliers?.[priority] ?? DEFAULT_FEE_MULTIPLIERS[priority];
    const amount = (Number(base) * multiplier).toFixed(8);
    return { amount, unit };
  }

  async getNetworkStatus(): Promise<{ healthy: boolean; latencyMs: number; blockHeight: bigint }> {
    const start = Date.now();
    const blockHeight = await this.getBlockHeight();
    return { healthy: true, latencyMs: Date.now() - start, blockHeight };
  }

  async getConfirmations(txHash: string): Promise<number> {
    const record = await this.prisma.chainTransaction.findUnique({
      where: { chain_txHash: { chain: this.chain, txHash } },
    });
    return record?.confirmations ?? 0;
  }

  async watchAddress(address: string): Promise<void> {
    await this.ledger.watchAddress(this.chain, address);
  }

  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const start = Date.now();
    try {
      await this.getBlockHeight();
      return { healthy: true, latencyMs: Date.now() - start };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : 'unknown provider error',
      };
    }
  }
}
