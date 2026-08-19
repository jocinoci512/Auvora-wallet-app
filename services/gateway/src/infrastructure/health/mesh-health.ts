import { isEmptyHostnameServiceUrl, type ServiceEnv } from '../../config/env.schema';

export type MeshComponentStatus = 'healthy' | 'degraded' | 'offline' | 'unknown';

export interface MeshComponentHealth {
  id: string;
  status: MeshComponentStatus;
  latencyMs: number | null;
}

const PRODUCTION_UPSTREAMS = [
  { id: 'auth-prods', key: 'AUTH_SERVICE_URL' },
  { id: 'wallet-prod', key: 'WALLET_SERVICE_URL' },
  { id: 'blockchain-prod', key: 'BLOCKCHAIN_SERVICE_URL' },
  { id: 'market-data-prod', key: 'MARKET_DATA_SERVICE_URL' },
  { id: 'connections-prod', key: 'CONNECTIONS_SERVICE_URL' },
] as const;

function isLocalFallback(url: string): boolean {
  return isEmptyHostnameServiceUrl(url) || /127\.0\.0\.1|localhost/i.test(url);
}

export async function probeHealthUrl(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: MeshComponentStatus; latencyMs: number | null }> {
  const started = Date.now();
  try {
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const latencyMs = Date.now() - started;
    if (response.ok) return { status: 'healthy', latencyMs };
    if (response.status >= 500) return { status: 'offline', latencyMs };
    return { status: 'degraded', latencyMs };
  } catch {
    return { status: 'offline', latencyMs: Date.now() - started };
  }
}

/** Probe the Closed Beta production mesh. Never returns hostnames or secrets. */
export async function collectGatewayMeshHealth(
  env: ServiceEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<MeshComponentHealth[]> {
  const rows: MeshComponentHealth[] = [{ id: 'gateway-prod', status: 'healthy', latencyMs: 0 }];

  const probes = PRODUCTION_UPSTREAMS.map(async (target) => {
    const url =
      target.key === 'AUTH_SERVICE_URL'
        ? env.AUTH_SERVICE_URL
        : target.key === 'WALLET_SERVICE_URL'
          ? env.WALLET_SERVICE_URL
          : target.key === 'BLOCKCHAIN_SERVICE_URL'
            ? env.BLOCKCHAIN_SERVICE_URL
            : target.key === 'MARKET_DATA_SERVICE_URL'
              ? env.MARKET_DATA_SERVICE_URL
              : env.CONNECTIONS_SERVICE_URL;
    if (!url || (env.NODE_ENV === 'production' && isLocalFallback(url))) {
      return { id: target.id, status: 'unknown' as const, latencyMs: null };
    }
    const result = await probeHealthUrl(url, fetchImpl);
    return { id: target.id, ...result };
  });

  rows.push(...(await Promise.all(probes)));
  return rows;
}
