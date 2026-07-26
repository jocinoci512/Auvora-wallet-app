import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { type ChainNetwork, ChainTxDirection, ChainTxStatus } from '@auvora/database';
import {
  CHAIN_ADDRESS_REPOSITORY,
  type ChainAddressRepositoryPort,
} from '../ports/chain-address-repository.port';
import {
  CHAIN_TRANSACTION_REPOSITORY,
  type ChainTransactionFilters,
  type ChainTransactionRecord,
  type ChainTransactionRepositoryPort,
} from '../ports/chain-transaction-repository.port';
import {
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRecord,
  type NetworkConfigRepositoryPort,
} from '../ports/network-config-repository.port';
import { PROVIDER_FACTORY, type ProviderFactoryPort } from '../ports/provider-factory.port';
import { SIMULATOR_LEDGER, type SimulatorLedgerPort } from '../ports/simulator-ledger.port';
import {
  BlockchainEventType,
  ConflictError,
  EVENT_BUS,
  type EventBusPort,
  NotFoundError,
  ValidationError,
} from '../../domain';
import {
  CUSTODY_SIGNING_CLIENT,
  type CustodySigningPort,
} from '../../infrastructure/custody/custody-signing-http.client';

export interface RecordDepositInput {
  chain: ChainNetwork;
  toAddress: string;
  amount: string;
  fromAddress?: string;
  txHash?: string;
}

export interface BroadcastWithdrawalInput {
  chain: ChainNetwork;
  fromAddress: string;
  toAddress: string;
  amount: string;
  addressId?: string;
  /** When set and custody is configured, request a custody signature before broadcast. */
  custodyKeyId?: string;
}

@Injectable()
export class TransactionEngine {
  constructor(
    @Inject(CHAIN_TRANSACTION_REPOSITORY) private readonly transactions: ChainTransactionRepositoryPort,
    @Inject(CHAIN_ADDRESS_REPOSITORY) private readonly addresses: ChainAddressRepositoryPort,
    @Inject(NETWORK_CONFIG_REPOSITORY) private readonly networkConfig: NetworkConfigRepositoryPort,
    @Inject(PROVIDER_FACTORY) private readonly providerFactory: ProviderFactoryPort,
    @Inject(SIMULATOR_LEDGER) private readonly ledger: SimulatorLedgerPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(CUSTODY_SIGNING_CLIENT) private readonly custodySigning: CustodySigningPort,
  ) {}

  async recordIncomingDeposit(input: RecordDepositInput): Promise<ChainTransactionRecord> {
    const network = await this.requireNetwork(input.chain);
    const address = await this.addresses.findByChainAddress(input.chain, input.toAddress);
    if (!address) {
      throw new NotFoundError(`No tracked address ${input.toAddress} on ${input.chain}`);
    }

    const txHash = input.txHash ?? this.generateTxHash(input.chain, input.toAddress);
    const existing = await this.transactions.findByChainTxHash(input.chain, txHash);
    if (existing) {
      throw new ConflictError(`Transaction ${txHash} already recorded`);
    }

    const created = await this.transactions.create({
      chain: input.chain,
      networkId: network.id,
      addressId: address.id,
      txHash,
      direction: ChainTxDirection.INCOMING,
      status: ChainTxStatus.MEMPOOL,
      amount: input.amount,
      fromAddress: input.fromAddress ?? null,
      toAddress: input.toAddress,
      requiredConfirmations: network.requiredConfirmations,
      broadcastAt: new Date(),
    });

    await this.ledger.credit(input.chain, input.toAddress, input.amount);
    await this.ledger.addToMempool(input.chain, txHash);

    await this.eventBus.publish({
      type: BlockchainEventType.DepositDetected,
      chain: input.chain,
      aggregateId: created.id,
      payload: { txHash, toAddress: input.toAddress, amount: input.amount },
    });

    return created;
  }

  async broadcastWithdrawal(input: BroadcastWithdrawalInput): Promise<ChainTransactionRecord> {
    const network = await this.requireNetwork(input.chain);
    const provider = this.providerFactory.getProvider(input.chain);

    if (!provider.validateAddress(input.toAddress)) {
      throw new ValidationError(`Invalid destination address for ${input.chain}`);
    }

    const balance = await this.ledger.getBalance(input.chain, input.fromAddress);
    if (Number(balance) < Number(input.amount)) {
      throw new ValidationError('Insufficient balance for withdrawal');
    }

    const unsignedPayload = JSON.stringify({
      from: input.fromAddress,
      to: input.toAddress,
      amount: input.amount,
    });

    let signature: string | undefined;
    if (input.custodyKeyId) {
      const signed = await this.custodySigning.sign({
        keyId: input.custodyKeyId,
        payload: unsignedPayload,
        amount: input.amount,
        asset: String(input.chain),
        destination: input.toAddress,
      });
      if (!signed.signed || !signed.signature) {
        throw new ValidationError(
          `Custody signing required but failed: ${(signed.reasons ?? ['unknown']).join(',')}`,
        );
      }
      signature = signed.signature;
    }

    const rawTxHex = Buffer.from(
      JSON.stringify({
        from: input.fromAddress,
        to: input.toAddress,
        amount: input.amount,
        signature,
      }),
    ).toString('hex');
    const { txHash } = await provider.broadcastTransaction(rawTxHex);

    await this.ledger.debit(input.chain, input.fromAddress, input.amount);

    const created = await this.transactions.create({
      chain: input.chain,
      networkId: network.id,
      addressId: input.addressId ?? null,
      txHash,
      direction: ChainTxDirection.OUTGOING,
      status: ChainTxStatus.MEMPOOL,
      amount: input.amount,
      fromAddress: input.fromAddress,
      toAddress: input.toAddress,
      requiredConfirmations: network.requiredConfirmations,
      broadcastAt: new Date(),
    });

    await this.eventBus.publish({
      type: BlockchainEventType.WithdrawalBroadcast,
      chain: input.chain,
      aggregateId: created.id,
      payload: { txHash, fromAddress: input.fromAddress, toAddress: input.toAddress, amount: input.amount },
    });

    return created;
  }

  async getTransaction(idOrHash: string): Promise<ChainTransactionRecord> {
    const tx = await this.transactions.findByIdOrHash(idOrHash);
    if (!tx) {
      throw new NotFoundError('Transaction not found');
    }
    return tx;
  }

  async listTransactions(
    filters: ChainTransactionFilters,
  ): Promise<{ items: ChainTransactionRecord[]; total: number }> {
    return this.transactions.list(filters);
  }

  async rebroadcast(id: string): Promise<ChainTransactionRecord> {
    const tx = await this.getTransaction(id);
    if (tx.status !== ChainTxStatus.FAILED && tx.status !== ChainTxStatus.MEMPOOL) {
      throw new ValidationError(`Cannot rebroadcast a transaction in status ${tx.status}`);
    }

    const provider = this.providerFactory.getProvider(tx.chain);
    const rawTxHex = Buffer.from(
      JSON.stringify({ from: tx.fromAddress, to: tx.toAddress, amount: tx.amount, retry: true }),
    ).toString('hex');
    const { txHash } = await provider.broadcastTransaction(rawTxHex);
    await this.ledger.addToMempool(tx.chain, txHash);

    const updated = await this.transactions.updateStatus(tx.id, ChainTxStatus.MEMPOOL, {
      broadcastAt: new Date(),
    });

    await this.eventBus.publish({
      type: BlockchainEventType.WithdrawalBroadcast,
      chain: tx.chain,
      aggregateId: tx.id,
      payload: { txHash, rebroadcast: true },
    });

    return updated;
  }

  async fail(id: string, reason: string): Promise<ChainTransactionRecord> {
    const tx = await this.getTransaction(id);
    const updated = await this.transactions.updateStatus(tx.id, ChainTxStatus.FAILED, {
      failureReason: reason,
      failedAt: new Date(),
    });

    await this.eventBus.publish({
      type: BlockchainEventType.TransactionFailed,
      chain: tx.chain,
      aggregateId: tx.id,
      payload: { reason },
    });

    return updated;
  }

  async cancel(id: string): Promise<ChainTransactionRecord> {
    const tx = await this.getTransaction(id);
    if (tx.status !== ChainTxStatus.MEMPOOL && tx.status !== ChainTxStatus.PENDING) {
      throw new ValidationError(`Cannot cancel a transaction in status ${tx.status}`);
    }

    if (tx.direction === ChainTxDirection.OUTGOING && tx.fromAddress) {
      await this.ledger.credit(tx.chain, tx.fromAddress, tx.amount);
    }

    return this.transactions.updateStatus(tx.id, ChainTxStatus.CANCELLED);
  }

  private async requireNetwork(chain: ChainNetwork): Promise<NetworkConfigRecord> {
    const network = await this.networkConfig.findByChain(chain);
    if (!network) {
      throw new NotFoundError(`Unsupported chain ${chain}`);
    }
    return network;
  }

  private generateTxHash(chain: ChainNetwork, address: string): string {
    return createHash('sha256').update(`${chain}:${address}:${randomBytes(12).toString('hex')}`).digest('hex');
  }
}
