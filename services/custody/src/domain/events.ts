export enum CustodyEventType {
  KeyGenerated = 'KeyGenerated',
  KeyRotated = 'KeyRotated',
  KeyRevoked = 'KeyRevoked',
  KeyDestroyed = 'KeyDestroyed',
  SigningRequested = 'SigningRequested',
  SigningApproved = 'SigningApproved',
  SigningRejected = 'SigningRejected',
  TransactionSigned = 'TransactionSigned',
  RecoveryStarted = 'RecoveryStarted',
  RecoveryCompleted = 'RecoveryCompleted',
  PolicyViolationDetected = 'PolicyViolationDetected',
}

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface DomainEvent {
  type: CustodyEventType;
  aggregateId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
