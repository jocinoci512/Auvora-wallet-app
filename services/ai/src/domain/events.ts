export enum AiEventType {
  RequestCompleted = 'RequestCompleted',
  RequestFailed = 'RequestFailed',
  ConversationCreated = 'ConversationCreated',
  ConversationArchived = 'ConversationArchived',
  MessageAppended = 'MessageAppended',
  MessageFeedbackRecorded = 'MessageFeedbackRecorded',
  DocumentIndexed = 'DocumentIndexed',
  DocumentIndexFailed = 'DocumentIndexFailed',
  KnowledgeSourceRefreshed = 'KnowledgeSourceRefreshed',
  PromptTemplateApproved = 'PromptTemplateApproved',
  PromptTemplateArchived = 'PromptTemplateArchived',
  PromptTemplateRolledBack = 'PromptTemplateRolledBack',
  ProviderHealthChecked = 'ProviderHealthChecked',
}

export const EVENT_BUS = Symbol('EVENT_BUS');

export interface DomainEvent {
  type: AiEventType;
  aggregateId?: string;
  correlationId?: string;
  payload: Record<string, unknown>;
}

export interface EventBusPort {
  publish(event: DomainEvent): Promise<void>;
}
