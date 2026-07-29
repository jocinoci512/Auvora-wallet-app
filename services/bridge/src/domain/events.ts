export const BRIDGE_EVENTS = {
  QUOTE_CREATED: 'bridge.quote.created',
  PREPARED: 'bridge.transfer.prepared',
  EXECUTED: 'bridge.transfer.executed',
  COMPLETED: 'bridge.transfer.completed',
  FAILED: 'bridge.transfer.failed',
  RETRIED: 'bridge.transfer.retried',
} as const;
