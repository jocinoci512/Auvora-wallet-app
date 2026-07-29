import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { BridgeProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';

@Injectable()
export class BridgeWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BridgeWorkersService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BridgeProviderRegistry) private readonly registry: BridgeProviderRegistry,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  onModuleInit(): void {
    if (!this.env.BRIDGE_WORKERS_ENABLED) {
      this.logger.log('Bridge workers disabled');
      return;
    }
    this.timers.push(
      setInterval(() => void this.statusWorker(), this.env.BRIDGE_STATUS_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.routeSyncWorker(), this.env.BRIDGE_ROUTE_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.feeRefreshWorker(), this.env.BRIDGE_FEE_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.processRetries(), this.env.BRIDGE_RETRY_INTERVAL_MS),
    );
    this.timers.push(setInterval(() => void this.healthTick(), this.env.BRIDGE_HEALTH_INTERVAL_MS));
    this.logger.log('Bridge workers started');
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  status() {
    return {
      enabled: this.env.BRIDGE_WORKERS_ENABLED,
      running: this.timers.length > 0,
      timers: this.timers.length,
    };
  }

  private async recordJob(jobType: string, fn: () => Promise<void>) {
    const started = Date.now();
    const id = this.ids.uuid();
    await this.prisma.bridgeSyncJob.create({
      data: { id, jobType, status: 'RUNNING' },
    });
    try {
      await fn();
      await this.prisma.bridgeSyncJob.update({
        where: { id },
        data: { status: 'COMPLETED', durationMs: Date.now() - started },
      });
    } catch (error) {
      await this.prisma.bridgeSyncJob.update({
        where: { id },
        data: {
          status: 'FAILED',
          durationMs: Date.now() - started,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      this.logger.warn(`${jobType}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async statusWorker() {
    await this.recordJob('BRIDGE_STATUS', async () => {
      await this.redis.set('bridge:worker:status', new Date().toISOString(), 120);
      const bridging = await this.prisma.bridgeTransfer.findMany({
        where: { status: 'BRIDGING', providerRef: { not: null } },
        take: 20,
      });
      for (const transfer of bridging) {
        try {
          const status = await this.registry.getExecutionStatus(transfer.providerRef!);
          await this.prisma.bridgeTransfer.update({
            where: { id: transfer.id },
            data: {
              status:
                status.status === 'COMPLETED'
                  ? 'COMPLETED'
                  : status.status === 'FAILED'
                    ? 'FAILED'
                    : 'BRIDGING',
              destinationTxHash: status.destinationTxHash,
              amountOutActual: status.amountOutActual,
              completedAt: status.status === 'COMPLETED' ? new Date() : undefined,
              errorMessage: status.errorMessage,
            },
          });
        } catch (error) {
          this.logger.warn(
            `status sync ${transfer.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    });
  }

  private async routeSyncWorker() {
    await this.recordJob('ROUTE_SYNC', async () => {
      await this.redis.set('bridge:worker:routes', new Date().toISOString(), 120);
      const routes = await this.registry.listRoutes();
      for (const route of routes) {
        await this.prisma.bridgeRouteCatalog.upsert({
          where: {
            providerCode_routeId: {
              providerCode: route.providerCode,
              routeId: route.routeId,
            },
          },
          create: {
            id: this.ids.uuid(),
            providerCode: route.providerCode,
            routeId: route.routeId,
            sourceNetwork: route.sourceNetwork,
            destinationNetwork: route.destinationNetwork,
            assetSymbol: route.assetSymbol,
            supported: route.supported,
            reason: route.reason,
            estimatedFeeNative: route.estimatedFeeNative,
            estimatedCompletionSeconds: route.estimatedCompletionSeconds,
            hops: route.hops as object,
            lastSyncedAt: new Date(),
          },
          update: {
            supported: route.supported,
            reason: route.reason,
            estimatedFeeNative: route.estimatedFeeNative,
            estimatedCompletionSeconds: route.estimatedCompletionSeconds,
            hops: route.hops as object,
            lastSyncedAt: new Date(),
          },
        });
      }
    });
  }

  private async feeRefreshWorker() {
    await this.recordJob('FEE_REFRESH', async () => {
      await this.redis.set('bridge:worker:fees', new Date().toISOString(), 120);
    });
  }

  private async processRetries() {
    await this.recordJob('RETRY_QUEUE', async () => {
      const jobs = await this.prisma.bridgeRetryJob.findMany({
        where: { status: 'PENDING' },
        take: 20,
      });
      for (const job of jobs) {
        await this.prisma.bridgeRetryJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
    });
  }

  private async healthTick() {
    try {
      await this.redis.set('bridge:worker:health', new Date().toISOString(), 120);
      for (const p of this.registry.listProviders()) {
        const health = await this.registry.getProvider(p.code).healthCheck();
        await this.prisma.bridgeProviderHealth.upsert({
          where: { code: p.code },
          create: {
            id: this.ids.uuid(),
            code: p.code,
            name: p.name,
            isEnabled: true,
            lastSuccessAt: health.healthy ? new Date() : null,
            lastFailureAt: health.healthy ? null : new Date(),
            lastLatencyMs: health.latencyMs,
            failureCount: health.healthy ? 0 : 1,
          },
          update: {
            lastSuccessAt: health.healthy ? new Date() : undefined,
            lastFailureAt: health.healthy ? undefined : new Date(),
            lastLatencyMs: health.latencyMs,
            failureCount: health.healthy ? 0 : { increment: 1 },
          },
        });
      }
    } catch (error) {
      this.logger.warn(`health worker: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
