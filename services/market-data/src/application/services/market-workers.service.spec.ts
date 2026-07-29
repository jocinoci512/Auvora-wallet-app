import { MarketWorkersService } from './market-workers.service';

describe('MarketWorkersService', () => {
  it('does not schedule when disabled', () => {
    const service = new MarketWorkersService(
      { MARKET_DATA_WORKERS_ENABLED: false } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    service.onModuleInit();
    expect(service.status().enabled).toBe(false);
    expect(service.status().workers).toEqual([]);
  });
});
