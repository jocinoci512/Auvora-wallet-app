export enum NotificationEventType {
  NotificationQueued = 'NotificationQueued',
  NotificationSent = 'NotificationSent',
  NotificationFailed = 'NotificationFailed',
  NotificationDelivered = 'NotificationDelivered',
  WebhookDelivered = 'WebhookDelivered',
  TemplateUpdated = 'TemplateUpdated',
  PreferenceUpdated = 'PreferenceUpdated',
}

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface DomainEvent {
  type: NotificationEventType;
  aggregateId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
