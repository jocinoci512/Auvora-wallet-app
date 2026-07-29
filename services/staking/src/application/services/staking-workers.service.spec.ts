import { StakingWorkersService } from './staking-workers.service';

describe('StakingWorkersService', () => {
  it('reports disabled workers when STAKING_WORKERS_ENABLED is false', () => {
    const env = { STAKING_WORKERS_ENABLED: false } as never;
    const workers = new StakingWorkersService(
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
