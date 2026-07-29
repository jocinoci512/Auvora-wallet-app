import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { ConnectionProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { ID_GENERATOR, type IdGeneratorPort } from '../ports/clock.port';
import { DappPlatformService } from './dapp-platform.service';

@Injectable()
export class ConnectionsWorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConnectionsWorkersService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConnectionProviderRegistry) private readonly registry: ConnectionProviderRegistry,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(DappPlatformService) private readonly dapps: DappPlatformService,
  ) {}

  onModuleInit(): void {
    if (!this.env.CONNECTIONS_WORKERS_ENABLED) {
      this.logger.log('Connections workers disabled');
      return;
    }
    this.timers.push(
      setInterval(() => void this.monitorConnections(), this.env.CONNECTIONS_MONITOR_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.monitorSessions(), this.env.CONNECTIONS_SESSION_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.deviceHealth(), this.env.CONNECTIONS_DEVICE_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.syncWorker(), this.env.CONNECTIONS_SYNC_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.processRetries(), this.env.CONNECTIONS_RETRY_INTERVAL_MS),
    );
    this.timers.push(
      setInterval(() => void this.healthTick(), this.env.CONNECTIONS_HEALTH_INTERVAL_MS),
    );
    this.logger.log('Connections workers started');
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }

  status() {
    return {
      enabled: this.env.CONNECTIONS_WORKERS_ENABLED,
      running: this.timers.length > 0,
      timers: this.timers.length,
    };
  }

  private async recordJob(jobType: string, fn: () => Promise<void>) {
    const started = Date.now();
    const id = this.ids.uuid();
    await this.prisma.connectionSyncJob.create({
      data: { id, jobType, status: 'RUNNING' },
    });
    try {
      await fn();
      await this.prisma.connectionSyncJob.update({
        where: { id },
        data: { status: 'COMPLETED', durationMs: Date.now() - started },
      });
    } catch (error) {
      await this.prisma.connectionSyncJob.update({
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

  private async monitorConnections() {
    await this.recordJob('CONNECTION_MONITOR', async () => {
      await this.redis.set('connections:worker:monitor', new Date().toISOString(), 120);
      const connected = await this.prisma.externalWalletConnection.count({
        where: { status: 'CONNECTED' },
      });
      await this.redis.set('connections:worker:connected', String(connected), 120);
    });
  }

  private async monitorSessions() {
    await this.recordJob('SESSION_MONITOR', async () => {
      await this.redis.set('connections:worker:sessions', new Date().toISOString(), 120);
      const expired = await this.prisma.walletConnectSession.findMany({
        where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
        take: 20,
      });
      for (const session of expired) {
        await this.prisma.walletConnectSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });
      }
      const expiredRequests = await this.dapps.expireStaleRequests();
      const expiredPermissions = await this.dapps.expireStalePermissions();
      await this.redis.set(
        'connections:worker:dapp-expiry',
        JSON.stringify({ expiredRequests, expiredPermissions, at: new Date().toISOString() }),
        120,
      );
    });
  }

  private async syncWorker() {
    await this.recordJob('PERMISSION_SYNC', async () => {
      await this.redis.set('connections:worker:sync', new Date().toISOString(), 120);
      const pending = await this.prisma.dappConnectionRequest.count({
        where: { status: 'PENDING' },
      });
      const activeGrants = await this.prisma.dappPermissionGrant.count({
        where: { allowed: true, revokedAt: null },
      });
      await this.redis.set(
        'connections:worker:permission-sync',
        JSON.stringify({ pending, activeGrants }),
        120,
      );
    });
  }

  private async deviceHealth() {
    await this.recordJob('DEVICE_HEALTH', async () => {
      await this.redis.set('connections:worker:devices', new Date().toISOString(), 120);
      await this.registry.discoverDevices();
    });
  }

  private async processRetries() {
    await this.recordJob('RETRY_QUEUE', async () => {
      const jobs = await this.prisma.connectionRetryJob.findMany({
        where: { status: 'PENDING' },
        take: 20,
      });
      for (const job of jobs) {
        await this.prisma.connectionRetryJob.update({
          where: { id: job.id },
          data: { status: 'PROCESSED', processedAt: new Date() },
        });
      }
    });
  }

  private async healthTick() {
    try {
      await this.redis.set('connections:worker:health', new Date().toISOString(), 120);
      for (const p of this.registry.listProviders()) {
        const health = await this.registry.getProvider(p.code).healthCheck();
        await this.prisma.connectionProviderHealth.upsert({
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
