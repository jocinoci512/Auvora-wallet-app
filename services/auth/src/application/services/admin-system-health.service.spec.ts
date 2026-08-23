import { AdminSystemHealthService } from './admin-system-health.service';

describe('AdminSystemHealthService', () => {
  const prisma = { isHealthy: jest.fn().mockResolvedValue(true) };
  const redis = { ping: jest.fn().mockResolvedValue(true) };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.isHealthy.mockResolvedValue(true);
    redis.ping.mockResolvedValue(true);
    global.fetch = jest.fn();
  });

  it('reports mesh diagnostics when gateway internal URL is not configured', async () => {
    const service = new AdminSystemHealthService(
      { GATEWAY_INTERNAL_URL: undefined, INTERNAL_API_KEY: 'x'.repeat(32) } as never,
      redis as never,
      prisma as never,
    );
    const result = await service.getProductionHealth();
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([expect.stringMatching(/GATEWAY_INTERNAL_URL/i)]),
    );
    expect(result.services.find((row) => row.id === 'gateway-prod')?.status).toBe('unknown');
    expect(result.services.find((row) => row.id === 'wallet-prod')?.status).toBe('unknown');
  });

  it('merges gateway mesh rows when internal probe succeeds', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        services: [
          { id: 'gateway-prod', status: 'healthy', latencyMs: 1 },
          { id: 'wallet-prod', status: 'healthy', latencyMs: 12 },
          { id: 'blockchain-prod', status: 'degraded', latencyMs: 20 },
          { id: 'market-data-prod', status: 'healthy', latencyMs: 8 },
          { id: 'connections-prod', status: 'healthy', latencyMs: 9 },
        ],
      }),
    });
    const service = new AdminSystemHealthService(
      {
        GATEWAY_INTERNAL_URL: 'http://gateway-prod.internal:4000',
        INTERNAL_API_KEY: 'x'.repeat(32),
      } as never,
      redis as never,
      prisma as never,
    );
    const result = await service.getProductionHealth();
    expect(result.diagnostics ?? []).toEqual([]);
    expect(result.services.find((row) => row.id === 'gateway-prod')?.status).toBe('healthy');
    expect(result.services.find((row) => row.id === 'wallet-prod')?.status).toBe('healthy');
    expect(result.services.find((row) => row.id === 'blockchain-prod')?.status).toBe('degraded');
  });
});
