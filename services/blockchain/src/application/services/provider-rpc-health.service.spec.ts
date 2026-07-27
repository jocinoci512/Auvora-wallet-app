import { ChainNetwork } from '@auvora/database';
import { ProviderRpcHealthService } from './provider-rpc-health.service';

describe('ProviderRpcHealthService', () => {
  it('reports alchemy backend when live methods exist', async () => {
    const provider = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 12, message: 'ok' }),
      getBlockHeight: jest.fn().mockResolvedValue(100n),
      getRpcMetrics: jest.fn().mockReturnValue({
        requests: 2,
        errors: 0,
        retries: 0,
        totalLatencyMs: 20,
        lastSuccessAt: '2026-01-01T00:00:00.000Z',
      }),
      getSafeEndpoint: jest.fn().mockReturnValue('ETHEREUM-alchemy'),
    };
    const factory = {
      getSupportedChains: () => [ChainNetwork.ETHEREUM],
      hasProvider: () => true,
      getProvider: () => provider,
    };
    const service = new ProviderRpcHealthService(factory as never);
    const result = await service.getOne(ChainNetwork.ETHEREUM);
    expect(result.backend).toBe('alchemy');
    expect(result.status).toBe('up');
    expect(result.latestBlockHeight).toBe('100');
    expect(result.endpoint).toBe('ETHEREUM-alchemy');
  });

  it('reports simulator backend without live metrics', async () => {
    const provider = {
      healthCheck: jest.fn().mockResolvedValue({ healthy: true, latencyMs: 1 }),
      getBlockHeight: jest.fn().mockResolvedValue(1n),
    };
    const factory = {
      getSupportedChains: () => [ChainNetwork.POLYGON],
      hasProvider: () => true,
      getProvider: () => provider,
    };
    const service = new ProviderRpcHealthService(factory as never);
    const all = await service.getAll();
    expect(all[0]?.backend).toBe('simulator');
    expect(all[0]?.status).toBe('up');
  });
});
