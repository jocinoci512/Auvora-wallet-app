import { PaymentEventType } from '../../domain';
import type { ProviderFactoryPort } from '../../application/ports/provider-factory.port';
import type { ProviderHealthRepositoryPort } from '../../application/ports/provider-health-repository.port';
import type { ProviderRecordRepositoryPort } from '../../application/ports/provider-record-repository.port';
import type { EventBusPort } from '../../domain';
import type { PaymentProvider } from '../../domain/provider.port';
import type { ServiceEnv } from '../../config/env.schema';
import { ProviderHealthMonitor } from './provider-health-monitor.service';

function makeProvider(code: string, healthy: boolean, message?: string): PaymentProvider {
  return {
    getCode: () => code,
    getName: () => code,
    listCapabilities: () => [],
    authorize: jest.fn(),
    capture: jest.fn(),
    refund: jest.fn(),
    reverse: jest.fn(),
    getStatus: jest.fn(),
    estimateFee: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ healthy, latencyMs: 5, message }),
  } as unknown as PaymentProvider;
}

describe('ProviderHealthMonitor', () => {
  function makeMonitor(providers: PaymentProvider[]) {
    const providerFactory: Partial<jest.Mocked<ProviderFactoryPort>> = {
      listProviders: jest.fn().mockReturnValue(providers),
    };
    const providerRecords: Partial<jest.Mocked<ProviderRecordRepositoryPort>> = {
      findByCode: jest.fn().mockResolvedValue(null),
    };
    const healthRepo: Partial<jest.Mocked<ProviderHealthRepositoryPort>> = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const eventBus: Partial<jest.Mocked<EventBusPort>> = {
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const env = { PAYMENTS_SIMULATOR_ENABLED: false, SETTLEMENT_INTERVAL_MS: 30000 } as ServiceEnv;

    const monitor = new ProviderHealthMonitor(
      providerFactory as ProviderFactoryPort,
      providerRecords as ProviderRecordRepositoryPort,
      healthRepo as ProviderHealthRepositoryPort,
      eventBus as EventBusPort,
      env,
    );
    return { monitor, providerRecords, healthRepo, eventBus };
  }

  it('records a HEALTHY snapshot and does not publish an event when a provider is healthy', async () => {
    const provider = makeProvider('local-fiat', true);
    const { monitor, healthRepo, eventBus } = makeMonitor([provider]);

    await monitor.runCheck();

    expect(healthRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ providerCode: 'local-fiat', status: 'HEALTHY' }),
    );
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('records an UNHEALTHY snapshot and publishes a ProviderUnavailable event when a provider is unhealthy', async () => {
    const provider = makeProvider('crypto-bridge', false, 'timeout');
    const { monitor, healthRepo, eventBus } = makeMonitor([provider]);

    await monitor.runCheck();

    expect(healthRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        providerCode: 'crypto-bridge',
        status: 'UNHEALTHY',
        errorMessage: 'timeout',
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PaymentEventType.ProviderUnavailable,
        payload: expect.objectContaining({ providerCode: 'crypto-bridge' }),
      }),
    );
  });

  it('checks every registered provider independently', async () => {
    const healthy = makeProvider('local-fiat', true);
    const unhealthy = makeProvider('merchant-sim', false);
    const { monitor, healthRepo } = makeMonitor([healthy, unhealthy]);

    await monitor.runCheck();

    expect(healthRepo.record).toHaveBeenCalledTimes(2);
  });
});
