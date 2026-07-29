export const MARKET_EVENT_PRICE_REFRESHED = 'market.price.refreshed';
export const MARKET_EVENT_METADATA_SYNCED = 'market.metadata.synced';
export const MARKET_EVENT_ALERT_TRIGGERED = 'market.alert.triggered';
export const MARKET_EVENT_PORTFOLIO_VALUED = 'market.portfolio.valued';
export const MARKET_EVENT_WATCHLIST_UPDATED = 'market.watchlist.updated';

export type MarketDomainEventType =
  | typeof MARKET_EVENT_PRICE_REFRESHED
  | typeof MARKET_EVENT_METADATA_SYNCED
  | typeof MARKET_EVENT_ALERT_TRIGGERED
  | typeof MARKET_EVENT_PORTFOLIO_VALUED
  | typeof MARKET_EVENT_WATCHLIST_UPDATED;
