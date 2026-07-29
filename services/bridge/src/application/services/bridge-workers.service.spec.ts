import { BridgeWorkersService } from './bridge-workers.service';

describe('BridgeWorkersService', () => {
  it('reports disabled workers when BRIDGE_WORKERS_ENABLED is false', () => {
    const env = { BRIDGE_WORKERS_ENABLED: false } as never;
    const service = new BridgeWorkersService(
      env,
      {} as never,
      {} as never,
      {} as never,
      {
        uuid: () => 'id',
      } as never,
    );
    service.onModuleInit();
    expect(service.status()).toEqual({ enabled: false, running: false, timers: 0 });
  });
});
