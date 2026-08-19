import { collectGatewayMeshHealth } from './mesh-health';
import type { ServiceEnv } from '../../config/env.schema';

function env(overrides: Partial<ServiceEnv> = {}): ServiceEnv {
  return {
    NODE_ENV: 'production',
    PORT: 4000,
    AUTH_SERVICE_URL: 'http://auth-prods.railway.internal:4001',
    WALLET_SERVICE_URL: 'http://wallet-prod.railway.internal:3002',
    BLOCKCHAIN_SERVICE_URL: 'http://blockchain-prod.railway.internal:3003',
    MARKET_DATA_SERVICE_URL: 'http://market-data-prod.railway.internal:3012',
    CONNECTIONS_SERVICE_URL: 'http://connections-prod.railway.internal:3016',
    PAYMENTS_SERVICE_URL: 'http://127.0.0.1:3004',
    COMPLIANCE_SERVICE_URL: 'http://127.0.0.1:3005',
    CUSTODY_SERVICE_URL: 'http://127.0.0.1:3009',
    NOTIFICATIONS_SERVICE_URL: 'http://127.0.0.1:3006',
    ANALYTICS_SERVICE_URL: 'http://127.0.0.1:3007',
    OBSERVABILITY_SERVICE_URL: 'http://127.0.0.1:3010',
    AI_SERVICE_URL: 'http://127.0.0.1:3008',
    SWAP_SERVICE_URL: 'http://127.0.0.1:3013',
    NFT_SERVICE_URL: 'http://127.0.0.1:3014',
    STAKING_SERVICE_URL: 'http://127.0.0.1:3015',
    BRIDGE_SERVICE_URL: 'http://127.0.0.1:3017',
    SERVICE_NAME: 'gateway',
    SERVICE_VERSION: '1.0.0-alpha.1',
    LOG_LEVEL: 'silent',
    CORS_ORIGINS: ['https://auvorawallet.com'],
    OTEL_ENABLED: false,
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    GATEWAY_RATE_LIMIT_MAX: 300,
    GATEWAY_RATE_LIMIT_WINDOW_SECONDS: 60,
    PROXY_TIMEOUT_MS: 30_000,
    ...overrides,
  } as ServiceEnv;
}

describe('collectGatewayMeshHealth', () => {
  it('labels production services and never returns hostnames', async () => {
    const fetchImpl = (async () => new Response(null, { status: 200 })) as typeof fetch;
    const rows = await collectGatewayMeshHealth(env(), fetchImpl);
    expect(rows.map((row) => row.id)).toEqual([
      'gateway-prod',
      'auth-prods',
      'wallet-prod',
      'blockchain-prod',
      'market-data-prod',
      'connections-prod',
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/railway|localhost|127\.0\.0\.1/i);
  });

  it('marks local production fallbacks as unknown instead of probing localhost', async () => {
    const fetchImpl = jest.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).not.toContain('127.0.0.1');
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch;
    const rows = await collectGatewayMeshHealth(
      env({ WALLET_SERVICE_URL: 'http://127.0.0.1:3002' }),
      fetchImpl,
    );
    expect(rows.find((row) => row.id === 'wallet-prod')?.status).toBe('unknown');
  });

  it('marks missing production upstreams as unknown', async () => {
    const fetchImpl = jest.fn(async () => new Response(null, { status: 200 }));
    const rows = await collectGatewayMeshHealth(
      env({ WALLET_SERVICE_URL: undefined }),
      fetchImpl as unknown as typeof fetch,
    );
    expect(rows.find((row) => row.id === 'wallet-prod')?.status).toBe('unknown');
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toMatch(/:3002/);
  });
});
