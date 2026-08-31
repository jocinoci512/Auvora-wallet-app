import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ForbiddenError, ValidationError } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';

const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const QA_LOCAL_CHAIN_ID = 31337;
const IDEMPOTENCY_PREFIX = 'wallet:onchain-completion:';

export interface ReportOnChainTransferCompletionInput {
  ownerUserId: string;
  txHash: string;
  chainId: number;
  networkLabel: string;
  assetCode: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  fee?: string;
  blockNumber?: number;
  confirmedAt?: string;
}

export interface ReportOnChainTransferCompletionResult {
  accepted: boolean;
  alreadyReported: boolean;
  txHash: string;
}

type RpcReceipt = {
  status?: string;
  blockNumber?: string;
  transactionHash?: string;
};

@Injectable()
export class OnChainTransferCompletionService {
  private readonly logger = new Logger(OnChainTransferCompletionService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Optional()
    @Inject(NOTIFICATIONS_PUBLISHER)
    private readonly notifications?: NotificationsPublisherPort,
  ) {}

  async report(
    input: ReportOnChainTransferCompletionInput,
  ): Promise<ReportOnChainTransferCompletionResult> {
    const txHash = input.txHash.trim().toLowerCase();
    if (!TX_HASH_RE.test(txHash)) {
      throw new ValidationError('Invalid transaction hash');
    }
    if (!input.fromAddress || !/^0x[a-fA-F0-9]{40}$/.test(input.fromAddress)) {
      throw new ValidationError('Invalid sender address');
    }
    if (!input.toAddress || !/^0x[a-fA-F0-9]{40}$/.test(input.toAddress)) {
      throw new ValidationError('Invalid recipient address');
    }
    this.assertSupportedChain(input.chainId);

    const idemKey = `${IDEMPOTENCY_PREFIX}${input.ownerUserId}:${txHash}`;
    const existing = await this.redis.getClient().get(idemKey);
    if (existing) {
      return { accepted: true, alreadyReported: true, txHash };
    }

    const ownsSender = await this.userOwnsEvmAddress(input.ownerUserId, input.fromAddress);
    if (!ownsSender) {
      throw new ForbiddenError('Sender address is not registered to this account');
    }

    const receipt = await this.fetchReceipt(input.chainId, txHash);
    if (!receipt) {
      throw new ValidationError('Transaction receipt not found on QA network');
    }
    if (receipt.status !== '0x1') {
      throw new ValidationError('Transaction did not succeed on-chain');
    }

    const tx = await this.fetchTransaction(input.chainId, txHash);
    if (tx?.from && tx.from.toLowerCase() !== input.fromAddress.toLowerCase()) {
      throw new ForbiddenError('On-chain sender does not match the reported address');
    }

    await this.notifications?.publishEvent({
      eventType: 'wallet.transfer.completed',
      aggregateId: txHash,
      payload: {
        ownerUserId: input.ownerUserId,
        txHash,
        hash: txHash,
        assetCode: input.assetCode,
        assetTicker: input.assetCode,
        amount: input.amount,
        networkLabel: input.networkLabel,
        network: input.networkLabel,
        fromAddress: input.fromAddress,
        toAddress: input.toAddress,
        fee: input.fee,
        blockNumber: input.blockNumber,
        confirmedAt: input.confirmedAt,
        chainId: input.chainId,
      },
    });

    await this.redis.getClient().set(idemKey, new Date().toISOString(), 'EX', 60 * 60 * 24 * 30);
    this.logger.log(`On-chain completion reported for ${txHash.slice(0, 10)}…`);
    return { accepted: true, alreadyReported: false, txHash };
  }

  private assertSupportedChain(chainId: number): void {
    if (this.env.NODE_ENV === 'production' && chainId === QA_LOCAL_CHAIN_ID) {
      throw new ValidationError('Local QA chain is not enabled in production');
    }
    const allowed = new Set([QA_LOCAL_CHAIN_ID, 11155111]);
    if (!allowed.has(chainId)) {
      throw new ValidationError('Unsupported chain for on-chain completion reporting');
    }
  }

  private async userOwnsEvmAddress(ownerUserId: string, address: string): Promise<boolean> {
    const normalized = address.toLowerCase();
    const watch = await this.prisma.watchAddress.findFirst({
      where: {
        userId: ownerUserId,
        address: { equals: address, mode: 'insensitive' },
        network: { in: ['ETHEREUM'] },
      },
      select: { id: true },
    });
    if (watch) return true;

    const chainAddr = await this.prisma.chainAddress.findFirst({
      where: {
        ownerUserId,
        address: { equals: address, mode: 'insensitive' },
        chain: { in: ['ETHEREUM'] },
      },
      select: { id: true },
    });
    if (chainAddr) return true;

    const wallets = await this.prisma.wallet.findMany({
      where: { ownerUserId },
      select: { metadata: true },
      take: 50,
    });
    for (const wallet of wallets) {
      const meta = wallet.metadata as { chainSync?: { address?: string } } | null;
      const synced = meta?.chainSync?.address;
      if (synced && synced.toLowerCase() === normalized) return true;
    }
    return false;
  }

  private rpcUrlForChain(chainId: number): string {
    if (chainId === QA_LOCAL_CHAIN_ID) {
      return process.env.AUVORA_QA_LOCAL_EVM_RPC_URL ?? 'http://127.0.0.1:8545';
    }
    throw new ValidationError('RPC verification is only configured for local QA EVM');
  }

  private async rpcCall<T>(chainId: number, method: string, params: unknown[]): Promise<T> {
    const url = this.rpcUrlForChain(chainId);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      throw new ValidationError(`RPC unavailable (${response.status})`);
    }
    const body = (await response.json()) as { result?: T; error?: { message?: string } };
    if (body.error) {
      throw new ValidationError(body.error.message ?? 'RPC error');
    }
    return body.result as T;
  }

  private async fetchReceipt(chainId: number, txHash: string): Promise<RpcReceipt | null> {
    try {
      return await this.rpcCall<RpcReceipt | null>(chainId, 'eth_getTransactionReceipt', [txHash]);
    } catch (error) {
      this.logger.warn(
        `Receipt lookup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private async fetchTransaction(
    chainId: number,
    txHash: string,
  ): Promise<{ from?: string } | null> {
    try {
      return await this.rpcCall<{ from?: string } | null>(chainId, 'eth_getTransactionByHash', [
        txHash,
      ]);
    } catch {
      return null;
    }
  }
}
