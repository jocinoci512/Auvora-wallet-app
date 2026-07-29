import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ChainNetwork, PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { StakingProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import { StakingEngineService } from './staking-engine.service';

@Injectable()
export class StakingWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StakingWorkersService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StakingProviderRegistry) private readonly registry: StakingProviderRegistry,
    @Inject(StakingEngineService) private readonly engine: StakingEngineService,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  onModuleInit(): void {
    if (!this.env.STAKING_WORKERS_ENABLED) {
      this.logger.log('Staking workers disabled');
      return;
    }
    this.timers.push(
      setInterval(() => void this.syncRewards(), this.env.STAKING_REWARD_SYNC_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.syncValidators(), this.env.STAKING_VALIDATOR_SYNC_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.syncPositions(), this.env.STAKING_POSITION_SYNC_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.calcRewards(), this.env.STAKING_REWARD_CALC_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.processRetries(), this.env.STAKING_RETRY_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.healthTick(), this.env.STAKING_HEALTH_INTERVAL_MS),
    );
    this.logger.log('Staking workers started');
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  status() {
    return {
      enabled: this.env.STAKING_WORKERS_ENABLED,
      running: this.timers.length > 0,
      timers: this.timers.length,
    };
  }

  private async recordJob(jobType: string, fn: () => Promise<void>) {
    const started = Date.now();
    const id = this.ids.uuid();
    await this.prisma.stakingSyncJob.create({
      data: { id, jobType, status: 'RUNNING' },
    });
    try {
      await fn();
      await this.prisma.stakingSyncJob.update({
        where: { id },
        data: { status: 'COMPLETED', durationMs: Date.now() - started },
      });
    } catch (error) {
      await this.prisma.stakingSyncJob.update({
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

  private async syncRewards() {
    await this.recordJob('REWARD_SYNC', async () => {
      await this.redis.set('staking:worker:rewards', new Date().toISOString(), 120);
      await this.engine.syncPendingRewards();
    });
  }

  private async syncValidators() {
    await this.recordJob('VALIDATOR_SYNC', async () => {
      await this.redis.set('staking:worker:validators', new Date().toISOString(), 120);
      for (const network of [
        ChainNetwork.ETHEREUM,
        ChainNetwork.SOLANA,
        ChainNetwork.BNB_SMART_CHAIN,
        ChainNetwork.TRON,
      ]) {
        try {
          await this.engine.listValidators(network);
        } catch {
          /* unsupported or transient */
        }
      }
    });
  }

  private async syncPositions() {
    await this.recordJob('POSITION_SYNC', async () => {
      await this.redis.set('staking:worker:positions', new Date().toISOString(), 120);
      const active = await this.prisma.stakingPosition.count({ where: { status: 'ACTIVE' } });
      await this.redis.set('staking:worker:positions:count', String(active), 120);
    });
  }

  private async calcRewards() {
    await this.recordJob('REWARD_CALC', async () => {
      await this.engine.syncPendingRewards();
    });
  }

  private async processRetries() {
    await this.recordJob('RETRY_QUEUE', async () => {
      const jobs = await this.prisma.stakingRetryJob.findMany({
        where: { status: 'PENDING' },
        take: 20,
      });
      for (const job of jobs) {
        await this.prisma.stakingRetryJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
    });
  }

  private async healthTick() {
    try {
      await this.redis.set('staking:worker:health', new Date().toISOString(), 120);
      for (const p of this.registry.listProviders()) {
        const health = await this.registry.getProvider(p.code).healthCheck();
        await this.prisma.stakingProviderHealth.upsert({
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
