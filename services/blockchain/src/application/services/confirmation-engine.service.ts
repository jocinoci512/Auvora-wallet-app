import { Inject, Injectable } from '@nestjs/common';
import { type ChainNetwork, ChainTxStatus } from '@auvora/database';
import {
  CHAIN_TRANSACTION_REPOSITORY,
  type ChainTransactionRecord,
  type ChainTransactionRepositoryPort,
} from '../ports/chain-transaction-repository.port';
import {
  NETWORK_CONFIG_REPOSITORY,
  type NetworkConfigRepositoryPort,
} from '../ports/network-config-repository.port';
import { BlockchainEventType, EVENT_BUS, type EventBusPort } from '../../domain';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';

@Injectable()
export class ConfirmationEngine {
  constructor(
    @Inject(CHAIN_TRANSACTION_REPOSITORY)
    private readonly transactions: ChainTransactionRepositoryPort,
    @Inject(NETWORK_CONFIG_REPOSITORY) private readonly networkConfig: NetworkConfigRepositoryPort,
    @Inject(EVENT_BUS) private readonly eventBus: EventBusPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
  ) {}

  /** Recomputes confirmations for every in-flight transaction on a chain against the latest block height. */
  async syncChainConfirmations(chain: ChainNetwork, currentHeight: bigint): Promise<void> {
    const config = await this.networkConfig.findByChain(chain);
    if (!config) {
      return;
    }
    const active = await this.transactions.findActiveByChain(chain);
    for (const tx of active) {
      await this.updateTransactionConfirmations(tx, currentHeight, config.requiredConfirmations);
    }
  }

  /**
   * Confirmation thresholds always come from `BlockchainNetworkConfig.requiredConfirmations`
   * (passed in by the caller, sourced from the DB) rather than being hardcoded per chain.
   */
  async updateTransactionConfirmations(
    tx: ChainTransactionRecord,
    currentHeight: bigint,
    requiredConfirmations: number,
  ): Promise<ChainTransactionRecord> {
    if (tx.blockNumber === null || tx.status === ChainTxStatus.CONFIRMED) {
      return tx;
    }

    const confirmations = Math.max(0, Number(currentHeight - BigInt(tx.blockNumber)) + 1);
    const updated = await this.transactions.updateConfirmations(
      tx.id,
      confirmations,
      tx.blockNumber,
    );

    if (confirmations >= requiredConfirmations) {
      const confirmed = await this.transactions.updateStatus(tx.id, ChainTxStatus.CONFIRMED, {
        confirmedAt: new Date(),
      });
      await this.eventBus.publish({
        type: BlockchainEventType.TransactionConfirmed,
        chain: tx.chain,
        aggregateId: tx.id,
        payload: { txHash: tx.txHash, confirmations },
      });
      await this.notifications.publishEvent({
        eventType: 'blockchain.transaction.confirmed',
        aggregateId: tx.id,
        payload: { chain: tx.chain, txHash: tx.txHash, confirmations },
      });
      await this.ai.publishEvent({
        eventType: 'blockchain.transaction.confirmed',
        aggregateId: tx.id,
        payload: { chain: tx.chain, txHash: tx.txHash, confirmations },
      });
      await this.analytics.publishEvent({
        eventType: 'blockchain.transaction.confirmed',
        domain: 'BLOCKCHAIN',
        aggregateId: tx.id,
        payload: { chain: tx.chain, txHash: tx.txHash, confirmations },
      });
      return confirmed;
    }

    return updated;
  }
}
