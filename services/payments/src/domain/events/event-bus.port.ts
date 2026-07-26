export enum PaymentEventType {
  PaymentCreated = 'PaymentCreated',
  PaymentAuthorized = 'PaymentAuthorized',
  PaymentProcessing = 'PaymentProcessing',
  PaymentSettled = 'PaymentSettled',
  PaymentCompleted = 'PaymentCompleted',
  PaymentFailed = 'PaymentFailed',
  PaymentCancelled = 'PaymentCancelled',
  PaymentExpired = 'PaymentExpired',
  PaymentRefunded = 'PaymentRefunded',
  PaymentReversed = 'PaymentReversed',
  PaymentDisputed = 'PaymentDisputed',
  PaymentChargeback = 'PaymentChargeback',
  SettlementBatchCreated = 'SettlementBatchCreated',
  SettlementBatchCompleted = 'SettlementBatchCompleted',
  SettlementBatchFailed = 'SettlementBatchFailed',
  SettlementCompleted = 'SettlementCompleted',
  SettlementFailed = 'SettlementFailed',
  ReconciliationMismatch = 'ReconciliationMismatch',
  ReconciliationResolved = 'ReconciliationResolved',
  ProviderUnavailable = 'ProviderUnavailable',
  LimitExceeded = 'LimitExceeded',
}

export interface PublishEventInput {
  type: PaymentEventType;
  aggregateId?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface EventBusPort {
  publish(input: PublishEventInput): Promise<void>;
}
