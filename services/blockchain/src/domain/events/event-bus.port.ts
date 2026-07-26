import type { ChainNetwork } from '@auvora/database';

export enum BlockchainEventType {
  DepositDetected = 'DepositDetected',
  WithdrawalBroadcast = 'WithdrawalBroadcast',
  TransactionConfirmed = 'TransactionConfirmed',
  TransactionFailed = 'TransactionFailed',
  BlockSynced = 'BlockSynced',
  AddressCreated = 'AddressCreated',
  WalletSynced = 'WalletSynced',
  ProviderUnavailable = 'ProviderUnavailable',
  ChainReorganization = 'ChainReorganization',
}

export interface PublishEventInput {
  type: BlockchainEventType;
  chain?: ChainNetwork;
  aggregateId?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface EventBusPort {
  publish(input: PublishEventInput): Promise<void>;
}
