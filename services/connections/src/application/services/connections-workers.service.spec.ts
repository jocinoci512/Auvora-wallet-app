import { ConnectionsWorkersService } from './connections-workers.service';

describe('ConnectionsWorkersService', () => {
  it('reports disabled workers when CONNECTIONS_WORKERS_ENABLED is false', () => {
    const env = { CONNECTIONS_WORKERS_ENABLED: false } as never;
    const workers = new ConnectionsWorkersService(
      env,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    workers.onModuleInit();
    expect(workers.status()).toEqual({ enabled: false, running: false, timers: 0 });
    workers.onModuleDestroy();
  });
});
