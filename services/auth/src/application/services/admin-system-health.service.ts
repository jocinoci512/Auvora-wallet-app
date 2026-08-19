import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';

export type MeshComponentStatus = 'healthy' | 'degraded' | 'offline' | 'unknown';

export interface MeshComponentHealth {
  id: string;
  status: MeshComponentStatus;
  latencyMs: number | null;
}

export interface ProductionSystemHealth {
  generatedAt: string;
  services: MeshComponentHealth[];
}

const CANONICAL_ORDER = [
  'gateway-prod',
  'auth-prods',
  'wallet-prod',
  'blockchain-prod',
  'market-data-prod',
  'connections-prod',
  'Postgres',
  'Redis',
] as const;

@Injectable()
export class AdminSystemHealthService {
  private readonly logger = new Logger(AdminSystemHealthService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async getProductionHealth(): Promise<ProductionSystemHealth> {
    const started = Date.now();
    const [dbHealthy, redisHealthy, mesh] = await Promise.all([
      this.prisma.isHealthy(),
      this.redis.ping(),
      this.fetchGatewayMesh(),
    ]);

    const byId = new Map<string, MeshComponentHealth>();
    for (const row of mesh) {
      byId.set(row.id, row);
    }
    byId.set('auth-prods', {
      id: 'auth-prods',
      status: dbHealthy && redisHealthy ? 'healthy' : 'degraded',
      latencyMs: Date.now() - started,
    });
    byId.set('Postgres', {
      id: 'Postgres',
      status: dbHealthy ? 'healthy' : 'offline',
      latencyMs: null,
    });
    byId.set('Redis', {
      id: 'Redis',
      status: redisHealthy ? 'healthy' : 'offline',
      latencyMs: null,
    });
    if (!byId.has('gateway-prod')) {
      byId.set('gateway-prod', {
        id: 'gateway-prod',
        status: this.env.GATEWAY_INTERNAL_URL ? 'offline' : 'unknown',
        latencyMs: null,
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      services: CANONICAL_ORDER.map(
        (id) => byId.get(id) ?? { id, status: 'unknown', latencyMs: null },
      ),
    };
  }

  private async fetchGatewayMesh(): Promise<MeshComponentHealth[]> {
    const base = this.env.GATEWAY_INTERNAL_URL?.replace(/\/$/, '');
    const key = this.env.INTERNAL_API_KEY;
    if (!base || !key) return [];
    try {
      const response = await fetch(`${base}/internal/mesh-health`, {
        headers: {
          accept: 'application/json',
          'x-internal-api-key': key,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return [];
      const body = (await response.json()) as { services?: MeshComponentHealth[] };
      return Array.isArray(body.services)
        ? body.services.filter((row) => isCanonicalId(row.id))
        : [];
    } catch (error) {
      this.logger.warn(
        `Gateway mesh health unavailable: ${error instanceof Error ? error.message : 'error'}`,
      );
      return [];
    }
  }
}

function isCanonicalId(id: string): boolean {
  return (CANONICAL_ORDER as readonly string[]).includes(id);
}
