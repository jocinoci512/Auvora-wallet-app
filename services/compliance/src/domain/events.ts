export enum ComplianceEventType {
  KYCStarted = 'KYCStarted',
  KYCCompleted = 'KYCCompleted',
  KYCRejected = 'KYCRejected',
  RiskScoreUpdated = 'RiskScoreUpdated',
  AMLAlertCreated = 'AMLAlertCreated',
  ComplianceCaseOpened = 'ComplianceCaseOpened',
  ComplianceCaseClosed = 'ComplianceCaseClosed',
  SanctionsMatchFound = 'SanctionsMatchFound',
  PEPMatchFound = 'PEPMatchFound',
  FraudDetected = 'FraudDetected',
  TravelRuleTriggered = 'TravelRuleTriggered',
}

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface DomainEvent {
  type: ComplianceEventType;
  aggregateId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
