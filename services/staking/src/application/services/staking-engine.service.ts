import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ChainNetwork, type Prisma, PrismaService } from '@auvora/database';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { formatAmount, parseAmount, projectedEarnings } from '../../domain/calculations';
import {
  StakingConfirmationRequiredError,
  StakingNotFoundError,
  StakingValidationError,
} from '../../domain/errors';
import { STAKING_EVENTS } from '../../domain/events';
import { STAKING_PROVIDER, type StakingProviderPort } from '../../domain/staking-provider.port';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';

@Injectable()
export class StakingEngineService {
  private readonly logger = new Logger(StakingEngineService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(STAKING_PROVIDER) private readonly providers: StakingProviderPort,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
  ) {}

  listNetworks() {
    return this.providers.getSupportedNetworks();
  }

  async listValidators(network: ChainNetwork, q?: string) {
    const remote = await this.providers.listValidators(network, q);
    for (const v of remote) {
      await this.prisma.stakingValidator.upsert({
        where: { network_validatorId: { network: v.network, validatorId: v.validatorId } },
        create: {
          id: this.ids.uuid(),
          network: v.network,
          validatorId: v.validatorId,
          name: v.name,
          address: v.address,
          status: v.status,
          commissionPercent: v.commissionPercent,
          apyPercent: v.apyPercent,
          uptimePercent: v.uptimePercent,
          totalDelegated: v.totalDelegated,
          delegatorCount: v.delegatorCount,
          performanceScore: v.performanceScore,
          lastSyncedAt: this.clock.now(),
        },
        update: {
          name: v.name,
          status: v.status,
          commissionPercent: v.commissionPercent,
          apyPercent: v.apyPercent,
          uptimePercent: v.uptimePercent,
          totalDelegated: v.totalDelegated,
          delegatorCount: v.delegatorCount,
          performanceScore: v.performanceScore,
          lastSyncedAt: this.clock.now(),
        },
      });
    }
    return this.prisma.stakingValidator.findMany({
      where: {
        network,
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { validatorId: { contains: q, mode: 'insensitive' } },
                { address: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { performanceScore: 'desc' },
    });
  }

  async getValidator(network: ChainNetwork, validatorId: string) {
    const local = await this.prisma.stakingValidator.findUnique({
      where: { network_validatorId: { network, validatorId } },
    });
    if (local) return local;
    const remote = await this.providers.getValidator(network, validatorId);
    if (!remote) throw new StakingNotFoundError('Validator not found');
    await this.listValidators(network);
    return this.prisma.stakingValidator.findUniqueOrThrow({
      where: { network_validatorId: { network, validatorId } },
    });
  }

  async estimate(input: {
    network: ChainNetwork;
    assetSymbol: string;
    amount: string;
    validatorId: string;
  }) {
    if (!input.amount || parseAmount(input.amount) <= 0) {
      throw new StakingValidationError('amount must be positive');
    }
    return this.providers.estimateRewards(input);
  }

  async prepareStake(
    userId: string,
    input: {
      network: ChainNetwork;
      assetSymbol: string;
      amount: string;
      validatorId: string;
      userAddress: string;
    },
  ) {
    const started = Date.now();
    const prepared = await this.providers.prepareStake(input);
    if (!prepared.simulationOk) {
      throw new StakingValidationError('Stake simulation failed', {
        detail: prepared.simulationDetail,
      });
    }
    const op = await this.prisma.stakingOperation.create({
      data: {
        id: this.ids.uuid(),
        userId,
        network: input.network,
        operationType: 'STAKE',
        status: 'PENDING',
        assetSymbol: input.assetSymbol,
        amount: input.amount,
        validatorId: input.validatorId,
        userAddress: input.userAddress,
        providerCode: prepared.providerCode,
        preparedTx: prepared as unknown as Prisma.InputJsonValue,
        estimatedCompletionSeconds: prepared.estimatedCompletionSeconds,
        confirmed: false,
      },
    });
    void this.analytics.publishEvent({
      eventType: STAKING_EVENTS.STAKE_PREPARED,
      aggregateId: op.id,
      payload: {
        userId,
        network: input.network,
        amount: input.amount,
        latencyMs: Date.now() - started,
      },
    });
    return { operationId: op.id, prepared, requiresConfirmation: true };
  }

  async prepareUnstake(
    userId: string,
    input: {
      network: ChainNetwork;
      assetSymbol: string;
      amount: string;
      validatorId: string;
      userAddress: string;
      positionId: string;
    },
  ) {
    const position = await this.prisma.stakingPosition.findFirst({
      where: { id: input.positionId, userId },
    });
    if (!position) throw new StakingNotFoundError('Position not found');
    const amount = parseAmount(input.amount);
    const staked = parseAmount(position.stakedAmount);
    if (amount <= 0 || amount > staked) {
      throw new StakingValidationError('Invalid unstake amount');
    }
    const prepared = await this.providers.prepareUnstake({
      ...input,
      positionRef: position.id,
    });
    const op = await this.prisma.stakingOperation.create({
      data: {
        id: this.ids.uuid(),
        userId,
        network: input.network,
        operationType: 'UNSTAKE',
        status: 'PENDING',
        assetSymbol: input.assetSymbol,
        amount: input.amount,
        validatorId: input.validatorId,
        userAddress: input.userAddress,
        positionId: position.id,
        providerCode: prepared.providerCode,
        preparedTx: prepared as unknown as Prisma.InputJsonValue,
        estimatedCompletionSeconds: prepared.estimatedCompletionSeconds,
        confirmed: false,
      },
    });
    void this.analytics.publishEvent({
      eventType: STAKING_EVENTS.UNSTAKE_PREPARED,
      aggregateId: op.id,
      payload: { userId, positionId: position.id, amount: input.amount },
    });
    return { operationId: op.id, prepared, requiresConfirmation: true };
  }

  async prepareClaim(
    userId: string,
    input: {
      network: ChainNetwork;
      assetSymbol: string;
      validatorId: string;
      userAddress: string;
      positionId: string;
    },
  ) {
    const position = await this.prisma.stakingPosition.findFirst({
      where: { id: input.positionId, userId },
    });
    if (!position) throw new StakingNotFoundError('Position not found');
    const prepared = await this.providers.prepareClaim({
      ...input,
      positionRef: position.id,
    });
    const op = await this.prisma.stakingOperation.create({
      data: {
        id: this.ids.uuid(),
        userId,
        network: input.network,
        operationType: 'CLAIM',
        status: 'PENDING',
        assetSymbol: input.assetSymbol,
        amount: position.pendingRewards,
        validatorId: input.validatorId,
        userAddress: input.userAddress,
        positionId: position.id,
        providerCode: prepared.providerCode,
        preparedTx: prepared as unknown as Prisma.InputJsonValue,
        estimatedCompletionSeconds: prepared.estimatedCompletionSeconds,
        confirmed: false,
      },
    });
    return { operationId: op.id, prepared, requiresConfirmation: true };
  }

  async confirmAndExecute(userId: string, operationId: string, confirmed: boolean) {
    const op = await this.prisma.stakingOperation.findFirst({
      where: { id: operationId, userId },
    });
    if (!op) throw new StakingNotFoundError('Operation not found');
    if (!confirmed) throw new StakingConfirmationRequiredError();
    if (op.status !== 'PENDING') {
      throw new StakingValidationError('Operation is not pending');
    }

    const providerRef = this.ids.uuid();
    await this.prisma.stakingOperation.update({
      where: { id: op.id },
      data: {
        confirmed: true,
        status: 'CONFIRMING',
        providerRef,
        confirmedAt: this.clock.now(),
      },
    });

    const status = await this.providers.getOperationStatus(providerRef);
    if (status.status === 'FAILED') {
      await this.prisma.stakingOperation.update({
        where: { id: op.id },
        data: { status: 'FAILED', errorMessage: status.errorMessage, txHash: status.txHash },
      });
      await this.prisma.stakingRetryJob.create({
        data: {
          id: this.ids.uuid(),
          operationId: op.id,
          jobType: 'OPERATION_RETRY',
          status: 'PENDING',
          payload: { providerRef } as Prisma.InputJsonValue,
          errorMessage: status.errorMessage,
        },
      });
      return { operationId: op.id, status: 'FAILED', errorMessage: status.errorMessage };
    }

    if (op.operationType === 'STAKE') {
      const estimate = await this.providers.estimateRewards({
        network: op.network,
        assetSymbol: op.assetSymbol,
        amount: op.amount,
        validatorId: op.validatorId,
      });
      const position = await this.prisma.stakingPosition.create({
        data: {
          id: this.ids.uuid(),
          userId,
          network: op.network,
          assetSymbol: op.assetSymbol,
          validatorId: op.validatorId,
          stakedAmount: op.amount,
          pendingRewards: '0',
          accumulatedRewards: '0',
          apyPercent: estimate.apyPercent,
          status: 'ACTIVE',
          userAddress: op.userAddress,
          lastSyncedAt: this.clock.now(),
        },
      });
      await this.prisma.stakingOperation.update({
        where: { id: op.id },
        data: {
          status: 'COMPLETED',
          positionId: position.id,
          txHash: status.txHash,
          completedAt: this.clock.now(),
        },
      });
      void this.notifications.publishEvent({
        eventType: STAKING_EVENTS.STAKE_EXECUTED,
        aggregateId: op.id,
        payload: {
          userId,
          title: 'Stake successful',
          body: `Staked ${op.amount} ${op.assetSymbol}`,
          positionId: position.id,
        },
      });
      void this.ai.publish(STAKING_EVENTS.STAKE_EXECUTED, { userId, amount: op.amount });
      return {
        operationId: op.id,
        status: 'COMPLETED',
        positionId: position.id,
        txHash: status.txHash,
      };
    }

    if (op.operationType === 'UNSTAKE' && op.positionId) {
      const position = await this.prisma.stakingPosition.findUnique({
        where: { id: op.positionId },
      });
      if (!position) throw new StakingNotFoundError('Position not found');
      const remaining = parseAmount(position.stakedAmount) - parseAmount(op.amount);
      await this.prisma.stakingPosition.update({
        where: { id: position.id },
        data: {
          stakedAmount: formatAmount(Math.max(0, remaining)),
          status: remaining <= 0 ? 'CLOSED' : 'ACTIVE',
          lastSyncedAt: this.clock.now(),
        },
      });
      await this.prisma.stakingOperation.update({
        where: { id: op.id },
        data: { status: 'COMPLETED', txHash: status.txHash, completedAt: this.clock.now() },
      });
      void this.notifications.publishEvent({
        eventType: STAKING_EVENTS.UNSTAKE_EXECUTED,
        aggregateId: op.id,
        payload: {
          userId,
          title: 'Unstake successful',
          body: `Unstaked ${op.amount} ${op.assetSymbol}`,
          positionId: position.id,
        },
      });
      return {
        operationId: op.id,
        status: 'COMPLETED',
        positionId: position.id,
        txHash: status.txHash,
      };
    }

    if (op.operationType === 'CLAIM' && op.positionId) {
      const position = await this.prisma.stakingPosition.findUnique({
        where: { id: op.positionId },
      });
      if (!position) throw new StakingNotFoundError('Position not found');
      const claimed = position.pendingRewards;
      await this.prisma.stakingReward.create({
        data: {
          id: this.ids.uuid(),
          userId,
          positionId: position.id,
          network: position.network,
          assetSymbol: position.assetSymbol,
          amount: claimed,
          status: 'CLAIMED',
          claimedAt: this.clock.now(),
        },
      });
      await this.prisma.stakingPosition.update({
        where: { id: position.id },
        data: {
          accumulatedRewards: formatAmount(
            parseAmount(position.accumulatedRewards) + parseAmount(claimed),
          ),
          pendingRewards: '0',
          lastSyncedAt: this.clock.now(),
        },
      });
      await this.prisma.stakingOperation.update({
        where: { id: op.id },
        data: { status: 'COMPLETED', txHash: status.txHash, completedAt: this.clock.now() },
      });
      void this.notifications.publishEvent({
        eventType: STAKING_EVENTS.REWARD_CLAIMED,
        aggregateId: op.id,
        payload: {
          userId,
          title: 'Rewards claimed',
          body: `Claimed ${claimed} ${position.assetSymbol}`,
          positionId: position.id,
        },
      });
      return {
        operationId: op.id,
        status: 'COMPLETED',
        positionId: position.id,
        txHash: status.txHash,
      };
    }

    throw new StakingValidationError('Unsupported operation');
  }

  async getOperation(userId: string, operationId: string) {
    const op = await this.prisma.stakingOperation.findFirst({ where: { id: operationId, userId } });
    if (!op) throw new StakingNotFoundError('Operation not found');
    return op;
  }

  async listPositions(userId: string, network?: ChainNetwork) {
    return this.prisma.stakingPosition.findMany({
      where: { userId, ...(network ? { network } : {}) },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getPosition(userId: string, positionId: string) {
    const position = await this.prisma.stakingPosition.findFirst({
      where: { id: positionId, userId },
      include: { rewards: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!position) throw new StakingNotFoundError('Position not found');
    return position;
  }

  async rewardHistory(userId: string, positionId?: string) {
    return this.prisma.stakingReward.findMany({
      where: { userId, ...(positionId ? { positionId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async pendingOperations(userId: string) {
    return this.prisma.stakingOperation.findMany({
      where: { userId, status: { in: ['PENDING', 'CONFIRMING', 'SUBMITTED'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async yieldAnalytics(userId: string) {
    const positions = await this.prisma.stakingPosition.findMany({ where: { userId } });
    const active = positions.filter((p) => p.status === 'ACTIVE');
    let totalStaked = 0;
    let pending = 0;
    let accumulated = 0;
    let projectedYearly = 0;
    const byNetwork: Record<string, number> = {};
    for (const p of active) {
      const staked = parseAmount(p.stakedAmount);
      totalStaked += staked;
      pending += parseAmount(p.pendingRewards);
      accumulated += parseAmount(p.accumulatedRewards);
      projectedYearly += projectedEarnings(staked, Number(p.apyPercent), 365);
      byNetwork[p.network] = (byNetwork[p.network] ?? 0) + staked;
    }
    const avgApy =
      active.length === 0
        ? 0
        : active.reduce((a, p) => a + Number(p.apyPercent), 0) / active.length;
    return {
      positions: active.length,
      totalStaked: formatAmount(totalStaked),
      pendingRewards: formatAmount(pending),
      accumulatedRewards: formatAmount(accumulated),
      estimatedApyPercent: Number(avgApy.toFixed(4)),
      projectedYearly: formatAmount(projectedYearly),
      portfolioAllocation: byNetwork,
    };
  }

  async syncPendingRewards(userId?: string) {
    const positions = await this.prisma.stakingPosition.findMany({
      where: { status: 'ACTIVE', ...(userId ? { userId } : {}) },
      take: 100,
    });
    for (const position of positions) {
      const daily = projectedEarnings(
        parseAmount(position.stakedAmount),
        Number(position.apyPercent),
        1,
      );
      const nextPending = formatAmount(parseAmount(position.pendingRewards) + daily / 24);
      await this.prisma.stakingPosition.update({
        where: { id: position.id },
        data: { pendingRewards: nextPending, lastSyncedAt: this.clock.now() },
      });
      if (parseAmount(nextPending) > 0) {
        void this.notifications.publishEvent({
          eventType: STAKING_EVENTS.REWARD_AVAILABLE,
          aggregateId: position.id,
          payload: {
            userId: position.userId,
            title: 'Rewards available',
            body: `Pending rewards: ${nextPending} ${position.assetSymbol}`,
          },
        });
      }
    }
    return { synced: positions.length };
  }
}
