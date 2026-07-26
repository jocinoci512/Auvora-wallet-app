export const EVENT_BUS = Symbol('EVENT_BUS');

export enum ObsEventType {
  MetricIngested = 'obs.metric.ingested',
  TraceIngested = 'obs.trace.ingested',
  LogIngested = 'obs.log.ingested',
  HealthRecorded = 'obs.health.recorded',
  AlertFired = 'obs.alert.fired',
  IncidentCreated = 'obs.incident.created',
  IncidentUpdated = 'obs.incident.updated',
}

export interface DomainEvent {
  type: ObsEventType | string;
  occurredAt: Date;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
