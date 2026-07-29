import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { SwapProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { SwapExecutionService } from './swap-execution.service';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';

@Injectable()
export class SwapWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SwapWorkersService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SwapProviderRegistry) private readonly registry: SwapProviderRegistry,
    @Inject(SwapExecutionService) private readonly execution: SwapExecutionService,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  onModuleInit(): void {
    if (!this.env.SWAP_WORKERS_ENABLED) {
      this.logger.log('Swap workers disabled');
      return;
    }
    this.timers.push(
      setInterval(() => void this.refreshQuotes(), this.env.SWAP_QUOTE_REFRESH_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.cacheRoutes(), this.env.SWAP_ROUTE_CACHE_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.monitorTransactions(), this.env.SWAP_TX_MONITOR_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.syncReceipts(), this.env.SWAP_RECEIPT_SYNC_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.processRetries(), this.env.SWAP_RETRY_INTERVAL_MS),
    );
    this.logger.log('Swap workers started');
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  status() {
    return {
      enabled: this.env.SWAP_WORKERS_ENABLED,
      running: this.timers.length > 0,
      timers: this.timers.length,
    };
  }

  private async refreshQuotes() {
    try {
      await this.redis.set('swap:worker:quote-refresh', new Date().toISOString(), 120);
      for (const p of this.registry.listProviders()) {
        const health = await this.registry.getProvider(p.code).healthCheck();
        await this.prisma.swapProviderHealth.upsert({
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
      this.logger.warn(
        `quote refresh worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async cacheRoutes() {
    try {
      await this.redis.set('swap:worker:route-cache', new Date().toISOString(), 120);
    } catch (error) {
      this.logger.warn(
        `route cache worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async monitorTransactions() {
    try {
      const open = await this.prisma.swapExecution.findMany({
        where: { status: { in: ['SUBMITTED', 'CONFIRMING'] } },
        take: 25,
      });
      for (const item of open) {
        await this.execution.monitor(item.id);
      }
    } catch (error) {
      this.logger.warn(
        `tx monitor worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async syncReceipts() {
    try {
      const completed = await this.prisma.swapExecution.findMany({
        where: { status: 'COMPLETED' },
        take: 25,
      });
      for (const item of completed) {
        await this.execution.monitor(item.id);
      }
    } catch (error) {
      this.logger.warn(
        `receipt sync worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async processRetries() {
    try {
      const jobs = await this.prisma.swapRetryJob.findMany({
        where: { status: 'PENDING' },
        take: 20,
      });
      for (const job of jobs) {
        await this.prisma.swapRetryJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(
        `retry queue worker: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
