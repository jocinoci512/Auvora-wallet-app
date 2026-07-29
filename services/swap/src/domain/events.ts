export const SWAP_EVENTS = {
  QUOTE_CREATED: 'swap.quote.created',
  SWAP_PREPARED: 'swap.prepared',
  SWAP_EXECUTED: 'swap.executed',
  SWAP_COMPLETED: 'swap.completed',
  SWAP_FAILED: 'swap.failed',
} as const;

export type SwapEventName = (typeof SWAP_EVENTS)[keyof typeof SWAP_EVENTS];
