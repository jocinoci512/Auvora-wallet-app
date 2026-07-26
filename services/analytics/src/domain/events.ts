export enum AnalyticsEventType {
  EventIngested = 'EventIngested',
  EventBatchIngested = 'EventBatchIngested',
  AggregationCompleted = 'AggregationCompleted',
  AggregationFailed = 'AggregationFailed',
  ReportGenerated = 'ReportGenerated',
  ReportFailed = 'ReportFailed',
  KpiEvaluated = 'KpiEvaluated',
  ForecastGenerated = 'ForecastGenerated',
  DashboardUpdated = 'DashboardUpdated',
}

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface DomainEvent {
  type: AnalyticsEventType;
  aggregateId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
