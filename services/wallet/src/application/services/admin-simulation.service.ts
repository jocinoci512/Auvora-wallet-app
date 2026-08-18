import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma, PrismaService } from '@auvora/database';
import {
  MARKET_DATA_HTTP_CLIENT,
  type MarketDataHttpClientPort,
} from '../../infrastructure/market-data/market-data-http.client';
import {
  ADMIN_EVENT_PUBLISHER,
  type AdminEventPublisherPort,
} from '../../infrastructure/realtime/admin-event-publisher.adapter';
import { NotFoundError, ValidationError } from '../../domain';
import { evaluateLargeTransferUsdCents } from '../../domain/large-transfer-review';

type Decimal = Prisma.Decimal;

const REVIEW_THRESHOLD_CENTS = 1_000_000n;
const LargeTransferReviewStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
const SimulationAccountStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
const SimulationBalanceEventType = {
  ACCOUNT_ENABLED: 'ACCOUNT_ENABLED',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  ASSET_ADDED: 'ASSET_ADDED',
  BALANCE_SET: 'BALANCE_SET',
  BALANCE_INCREASED: 'BALANCE_INCREASED',
  BALANCE_DECREASED: 'BALANCE_DECREASED',
  ASSET_REMOVED: 'ASSET_REMOVED',
  PORTFOLIO_RESET: 'PORTFOLIO_RESET',
  PRESET_APPLIED: 'PRESET_APPLIED',
} as const;
const SimulationTransactionStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
  SECURITY_HOLD: 'SECURITY_HOLD',
  PENDING_REVIEW: 'PENDING_REVIEW',
} as const;
type LargeTransferReviewStatusValue =
  (typeof LargeTransferReviewStatus)[keyof typeof LargeTransferReviewStatus];
type SimulationBalanceEventTypeValue =
  (typeof SimulationBalanceEventType)[keyof typeof SimulationBalanceEventType];
type SimulationTransactionStatusValue =
  (typeof SimulationTransactionStatus)[keyof typeof SimulationTransactionStatus];

type AssetWithQuote = {
  id: string;
  code: string;
  symbol: string;
  name: string;
  chain: string;
  decimals: number;
  marketQuote: {
    price: Decimal;
    source: string;
    asOf: Date;
  } | null;
};

@Injectable()
export class AdminSimulationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ADMIN_EVENT_PUBLISHER) private readonly adminEvents: AdminEventPublisherPort,
    @Optional()
    @Inject(MARKET_DATA_HTTP_CLIENT)
    private readonly marketData?: MarketDataHttpClientPort,
  ) {}

  async listActiveAssets(): Promise<Array<Record<string, string | number | null>>> {
    const assets = await this.prisma.asset.findMany({
      where: { isActive: true },
      orderBy: [{ chain: 'asc' }, { code: 'asc' }],
      include: {
        marketMetadata: {
          include: {
            quotes: {
              where: { quoteCurrency: 'USD' },
              take: 1,
              orderBy: { asOf: 'desc' },
            },
          },
        },
      },
    });
    return assets.map((asset) => ({
      code: asset.code,
      symbol: asset.symbol,
      name: asset.name,
      chain: asset.chain,
      decimals: asset.decimals,
      priceUsd: asset.marketMetadata?.quotes[0]?.price.toFixed() ?? null,
      priceSource: asset.marketMetadata?.quotes[0]?.source ?? null,
      priceTimestamp: asset.marketMetadata?.quotes[0]?.asOf.toISOString() ?? null,
    }));
  }

  async listSimulationAccounts(query?: string): Promise<
    Array<{
      id: string;
      ownerUserId: string;
      status: string;
      assetCount: number;
      updatedAt: string;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.simulationAccount.findMany({
      where: query
        ? {
            ownerUserId: {
              in: (
                await this.prisma.user.findMany({
                  where: {
                    OR: [
                      { email: { contains: query, mode: 'insensitive' } },
                      { username: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                  select: { id: true },
                  take: 50,
                })
              ).map((user) => user.id),
            },
          }
        : undefined,
      include: {
        balances: { include: { asset: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      ownerUserId: row.ownerUserId,
      status: row.status,
      assetCount: row.balances.length,
      updatedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async getSimulationAccount(ownerUserId: string): Promise<Record<string, unknown> | null> {
    const account = await this.prisma.simulationAccount.findUnique({
      where: { ownerUserId },
      include: {
        balances: {
          include: {
            asset: {
              include: {
                marketMetadata: {
                  include: {
                    quotes: {
                      where: { quoteCurrency: 'USD' },
                      take: 1,
                      orderBy: { asOf: 'desc' },
                    },
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
        },
        events: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { asset: true },
        },
        transactions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { asset: true, review: true },
        },
      },
    });
    if (!account) {
      return null;
    }
    return {
      id: account.id,
      ownerUserId: account.ownerUserId,
      status: account.status,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
      balances: account.balances.map((balance) => {
        const quote = balance.asset.marketMetadata?.quotes[0] ?? null;
        const valueUsd = quote
          ? new Prisma.Decimal(balance.quantity).mul(quote.price).toFixed(2)
          : null;
        return {
          id: balance.id,
          assetCode: balance.asset.code,
          assetSymbol: balance.asset.symbol,
          assetName: balance.asset.name,
          chain: balance.asset.chain,
          quantity: balance.quantity.toFixed(),
          valueUsd,
          priceUsd: quote?.price.toFixed() ?? null,
          priceSource: quote?.source ?? null,
          priceTimestamp: quote?.asOf.toISOString() ?? null,
          label: 'TEST FUNDS',
          updatedAt: balance.updatedAt.toISOString(),
        };
      }),
      events: account.events.map((event) => ({
        id: event.id,
        assetCode: event.asset?.code ?? null,
        eventType: event.eventType,
        previousQuantity: event.previousQuantity?.toFixed() ?? null,
        newQuantity: event.newQuantity?.toFixed() ?? null,
        deltaQuantity: event.deltaQuantity?.toFixed() ?? null,
        valuationUsd: event.valuationUsd?.toFixed(2) ?? null,
        reason: event.reason,
        adminUserId: event.adminUserId,
        createdAt: event.createdAt.toISOString(),
      })),
      transactions: account.transactions.map((tx) => ({
        id: tx.id,
        reference: tx.reference,
        status: tx.status,
        direction: tx.direction,
        assetCode: tx.asset.code,
        amount: tx.amount.toFixed(),
        feeAmount: tx.feeAmount.toFixed(),
        destinationAddress: tx.destinationAddress,
        note: tx.note,
        reviewId: tx.reviewId,
        createdAt: tx.createdAt.toISOString(),
        completedAt: tx.completedAt?.toISOString() ?? null,
      })),
    };
  }

  async enableTestAccount(
    ownerUserId: string,
    actorUserId: string,
    reason: string,
  ): Promise<Record<string, unknown> | null> {
    await this.requireUser(ownerUserId);
    const account = await this.prisma.simulationAccount.upsert({
      where: { ownerUserId },
      create: {
        ownerUserId,
        status: SimulationAccountStatus.ACTIVE,
        createdByUserId: actorUserId,
        updatedByUserId: actorUserId,
      },
      update: {
        status: SimulationAccountStatus.ACTIVE,
        updatedByUserId: actorUserId,
      },
    });
    await this.recordAudit('TEST_ACCOUNT_CLASSIFIED', actorUserId, ownerUserId, {
      reason,
      simulationAccountId: account.id,
      status: account.status,
    });
    await this.recordSimulationEvent({
      simulationAccountId: account.id,
      eventType: SimulationBalanceEventType.ACCOUNT_ENABLED,
      reason,
      adminUserId: actorUserId,
      metadata: { status: 'ACTIVE' },
    });
    return this.getSimulationAccount(ownerUserId);
  }

  async disableTestAccount(
    ownerUserId: string,
    actorUserId: string,
    reason: string,
  ): Promise<Record<string, unknown> | null> {
    const account = await this.requireSimulationAccount(ownerUserId);
    await this.prisma.simulationAccount.update({
      where: { id: account.id },
      data: {
        status: SimulationAccountStatus.DISABLED,
        updatedByUserId: actorUserId,
      },
    });
    await this.recordAudit('TEST_ACCOUNT_UNCLASSIFIED', actorUserId, ownerUserId, {
      reason,
      simulationAccountId: account.id,
      status: 'DISABLED',
    });
    await this.recordSimulationEvent({
      simulationAccountId: account.id,
      eventType: SimulationBalanceEventType.ACCOUNT_DISABLED,
      reason,
      adminUserId: actorUserId,
      metadata: { status: 'DISABLED' },
    });
    return this.getSimulationAccount(ownerUserId);
  }

  async upsertBalance(input: {
    ownerUserId: string;
    assetCode: string;
    operation: 'set' | 'increase' | 'decrease';
    amount: string;
    actorUserId: string;
    reason: string;
  }): Promise<Record<string, unknown> | null> {
    const account = await this.requireActiveSimulationAccount(input.ownerUserId);
    const asset = await this.requireAsset(input.assetCode);
    const amount = this.parseAmount(input.amount);
    const balance = await this.prisma.simulationBalance.findFirst({
      where: { simulationAccountId: account.id, assetId: asset.id },
    });
    const previous = balance?.quantity ?? new Prisma.Decimal(0);
    let next = previous;
    if (input.operation === 'set') next = amount;
    if (input.operation === 'increase') next = previous.add(amount);
    if (input.operation === 'decrease') {
      next = previous.sub(amount);
      if (next.lessThan(0)) {
        throw new ValidationError('Simulation balance cannot go below zero');
      }
    }
    const saved = balance
      ? await this.prisma.simulationBalance.update({
          where: { id: balance.id },
          data: { quantity: next },
        })
      : await this.prisma.simulationBalance.create({
          data: {
            simulationAccountId: account.id,
            assetId: asset.id,
            quantity: next,
          },
        });
    await this.recordAudit('SIMULATION_BALANCE_CHANGED', input.actorUserId, input.ownerUserId, {
      reason: input.reason,
      assetCode: asset.code,
      operation: input.operation,
      previousQuantity: previous.toFixed(),
      newQuantity: next.toFixed(),
    });
    await this.recordSimulationEvent({
      simulationAccountId: account.id,
      simulationBalanceId: saved.id,
      assetId: asset.id,
      eventType:
        input.operation === 'set'
          ? balance
            ? SimulationBalanceEventType.BALANCE_SET
            : SimulationBalanceEventType.ASSET_ADDED
          : input.operation === 'increase'
            ? SimulationBalanceEventType.BALANCE_INCREASED
            : SimulationBalanceEventType.BALANCE_DECREASED,
      previousQuantity: previous,
      newQuantity: next,
      deltaQuantity: input.operation === 'decrease' ? amount.mul(-1) : next.sub(previous),
      valuationUsd: await this.valueUsd(asset, next),
      reason: input.reason,
      adminUserId: input.actorUserId,
      metadata: { assetCode: asset.code, chain: asset.chain },
    });
    this.emitSimulationEvent(input.ownerUserId, asset.code, next.toFixed(), input.reason);
    return this.getSimulationAccount(input.ownerUserId);
  }

  async removeBalance(
    ownerUserId: string,
    assetCode: string,
    actorUserId: string,
    reason: string,
  ): Promise<Record<string, unknown> | null> {
    const account = await this.requireActiveSimulationAccount(ownerUserId);
    const asset = await this.requireAsset(assetCode);
    const balance = await this.prisma.simulationBalance.findFirst({
      where: { simulationAccountId: account.id, assetId: asset.id },
    });
    if (!balance) {
      throw new NotFoundError(`Simulation balance not found for ${assetCode}`);
    }
    await this.prisma.simulationBalance.delete({ where: { id: balance.id } });
    await this.recordAudit('SIMULATION_BALANCE_CHANGED', actorUserId, ownerUserId, {
      reason,
      assetCode: asset.code,
      operation: 'remove',
      previousQuantity: balance.quantity.toFixed(),
      newQuantity: '0',
    });
    await this.recordSimulationEvent({
      simulationAccountId: account.id,
      assetId: asset.id,
      eventType: SimulationBalanceEventType.ASSET_REMOVED,
      previousQuantity: balance.quantity,
      newQuantity: new Prisma.Decimal(0),
      deltaQuantity: balance.quantity.mul(-1),
      valuationUsd: new Prisma.Decimal(0),
      reason,
      adminUserId: actorUserId,
      metadata: { assetCode: asset.code, chain: asset.chain },
    });
    this.emitSimulationEvent(ownerUserId, asset.code, '0', reason);
    return this.getSimulationAccount(ownerUserId);
  }

  async resetPortfolio(
    ownerUserId: string,
    actorUserId: string,
    reason: string,
  ): Promise<Record<string, unknown> | null> {
    const account = await this.requireActiveSimulationAccount(ownerUserId);
    await this.prisma.simulationBalance.deleteMany({ where: { simulationAccountId: account.id } });
    await this.recordAudit('SIMULATION_PORTFOLIO_RESET', actorUserId, ownerUserId, {
      reason,
      simulationAccountId: account.id,
    });
    await this.recordSimulationEvent({
      simulationAccountId: account.id,
      eventType: SimulationBalanceEventType.PORTFOLIO_RESET,
      reason,
      adminUserId: actorUserId,
      metadata: { cleared: true },
    });
    this.emitSimulationEvent(ownerUserId, null, null, reason);
    return this.getSimulationAccount(ownerUserId);
  }

  async applyPreset(
    ownerUserId: string,
    presetCode: string,
    actorUserId: string,
    reason: string,
  ): Promise<Record<string, unknown> | null> {
    const account = await this.requireActiveSimulationAccount(ownerUserId);
    const assets = await this.listActiveAssets();
    const supported = new Set(assets.map((asset) => asset.code));
    const preset = this.presetHoldings(presetCode).filter((row) => supported.has(row.assetCode));
    if (preset.length === 0) {
      throw new ValidationError('Preset is unavailable for the current supported asset catalog');
    }
    for (const row of preset) {
      await this.upsertBalance({
        ownerUserId,
        assetCode: row.assetCode,
        operation: 'set',
        amount: row.quantity,
        actorUserId,
        reason: `${reason} [preset:${presetCode}]`,
      });
    }
    await this.recordAudit('SIMULATION_PRESET_APPLIED', actorUserId, ownerUserId, {
      reason,
      presetCode,
      simulationAccountId: account.id,
    });
    await this.recordSimulationEvent({
      simulationAccountId: account.id,
      eventType: SimulationBalanceEventType.PRESET_APPLIED,
      reason,
      adminUserId: actorUserId,
      metadata: { presetCode },
    });
    return this.getSimulationAccount(ownerUserId);
  }

  async createScenarioTransaction(input: {
    ownerUserId: string;
    assetCode: string;
    scenario:
      | 'incoming_transfer'
      | 'outgoing_success'
      | 'insufficient_balance'
      | 'pending_transaction'
      | 'failed_transaction'
      | 'rejected_transaction'
      | 'large_transfer_review'
      | 'security_hold';
    amount: string;
    destinationAddress?: string;
    note?: string;
    actorUserId: string;
    reason: string;
  }): Promise<unknown> {
    const account = await this.requireActiveSimulationAccount(input.ownerUserId);
    const asset = await this.requireAsset(input.assetCode);
    const amount = this.parseAmount(input.amount);
    const balance = await this.requireSimulationBalance(account.id, asset.id);
    const reference = `sim_tx_${crypto.randomUUID()}`;

    if (input.scenario === 'incoming_transfer') {
      await this.upsertBalance({
        ownerUserId: input.ownerUserId,
        assetCode: input.assetCode,
        operation: 'increase',
        amount: input.amount,
        actorUserId: input.actorUserId,
        reason: input.reason,
      });
      return this.prisma.simulationTransaction.create({
        data: {
          simulationAccountId: account.id,
          simulationBalanceId: balance.id,
          assetId: asset.id,
          walletId: null,
          reference,
          status: SimulationTransactionStatus.COMPLETED,
          direction: 'incoming',
          amount,
          destinationAddress: input.destinationAddress ?? null,
          note: input.note ?? 'Simulation incoming transfer completed',
          completedAt: new Date(),
          metadata: { scenario: input.scenario, label: 'SIMULATED' },
        },
      });
    }

    if (input.scenario === 'outgoing_success') {
      if (balance.quantity.lessThan(amount)) {
        throw new ValidationError('Simulation balance is insufficient for this scenario');
      }
      await this.upsertBalance({
        ownerUserId: input.ownerUserId,
        assetCode: input.assetCode,
        operation: 'decrease',
        amount: input.amount,
        actorUserId: input.actorUserId,
        reason: input.reason,
      });
      return this.prisma.simulationTransaction.create({
        data: {
          simulationAccountId: account.id,
          simulationBalanceId: balance.id,
          assetId: asset.id,
          reference,
          status: SimulationTransactionStatus.COMPLETED,
          direction: 'outgoing',
          amount,
          destinationAddress: input.destinationAddress ?? null,
          note: input.note ?? 'Simulation transaction completed',
          completedAt: new Date(),
          metadata: { scenario: input.scenario, label: 'SIMULATED' },
        },
      });
    }

    if (input.scenario === 'insufficient_balance') {
      return this.prisma.simulationTransaction.create({
        data: {
          simulationAccountId: account.id,
          simulationBalanceId: balance.id,
          assetId: asset.id,
          reference,
          status: SimulationTransactionStatus.FAILED,
          direction: 'outgoing',
          amount,
          destinationAddress: input.destinationAddress ?? null,
          note: input.note ?? 'Simulation insufficient balance',
          completedAt: new Date(),
          metadata: {
            scenario: input.scenario,
            error: 'INSUFFICIENT_BALANCE',
            label: 'SIMULATED',
          },
        },
      });
    }

    if (input.scenario === 'large_transfer_review') {
      const price = await this.latestPrice(asset);
      const decision = evaluateLargeTransferUsdCents({
        amountSmallest: this.toSmallestUnit(amount, asset.decimals),
        decimals: asset.decimals,
        usdCentsPerWholeToken: price?.usdCentsPerWholeToken ?? null,
        priceAt: price?.timestamp ?? null,
        thresholdCents: REVIEW_THRESHOLD_CENTS,
      });
      const tx = await this.prisma.simulationTransaction.create({
        data: {
          simulationAccountId: account.id,
          simulationBalanceId: balance.id,
          assetId: asset.id,
          reference,
          status: SimulationTransactionStatus.PENDING_REVIEW,
          direction: 'outgoing',
          amount,
          destinationAddress: input.destinationAddress ?? null,
          note: input.note ?? 'Simulation large transfer review',
          metadata: {
            scenario: input.scenario,
            label: 'SIMULATED',
            reviewStatus: decision.status,
          },
        },
      });
      const review = await this.prisma.largeTransferReview.create({
        data: {
          ownerUserId: input.ownerUserId,
          walletId: null,
          assetId: asset.id,
          sourceType: 'SIMULATION_TRANSACTION',
          sourceId: tx.id,
          network: asset.chain,
          fromAddress: null,
          destinationAddress: input.destinationAddress ?? 'simulation_destination',
          amount,
          amountUsdCents: decision.notionalUsdCents ?? 0n,
          priceUsdCentsPerWhole: price?.usdCentsPerWholeToken ?? null,
          priceTimestamp: price?.timestamp ?? null,
          status: LargeTransferReviewStatus.PENDING,
          requestedByUserId: input.ownerUserId,
          metadata: {
            scenario: input.scenario,
            label: 'SIMULATED',
            decisionStatus: decision.status,
          },
        },
      });
      await this.prisma.simulationTransaction.update({
        where: { id: tx.id },
        data: { reviewId: review.id },
      });
      await this.recordAudit(
        'LARGE_TRANSFER_REVIEW_CREATED',
        input.actorUserId,
        input.ownerUserId,
        {
          reason: input.reason,
          reviewId: review.id,
          sourceType: 'SIMULATION_TRANSACTION',
          assetCode: asset.code,
        },
      );
      await this.adminEvents.publish({
        type: 'TRANSACTION_REVIEW_CREATED',
        userId: input.ownerUserId,
        targetId: review.id,
        severity: 'warning',
        metadata: { assetCode: asset.code, network: asset.chain, simulated: true },
      });
      return { transactionId: tx.id, reviewId: review.id, status: review.status };
    }

    const statusMap: Record<string, SimulationTransactionStatusValue> = {
      pending_transaction: SimulationTransactionStatus.PENDING,
      failed_transaction: SimulationTransactionStatus.FAILED,
      rejected_transaction: SimulationTransactionStatus.REJECTED,
      security_hold: SimulationTransactionStatus.SECURITY_HOLD,
    };
    return this.prisma.simulationTransaction.create({
      data: {
        simulationAccountId: account.id,
        simulationBalanceId: balance.id,
        assetId: asset.id,
        reference,
        status: statusMap[input.scenario],
        direction: 'outgoing',
        amount,
        destinationAddress: input.destinationAddress ?? null,
        note: input.note ?? 'Simulation transaction recorded',
        completedAt: input.scenario === 'pending_transaction' ? null : new Date(),
        metadata: { scenario: input.scenario, label: 'SIMULATED' },
      },
    });
  }

  async listReviews(filters: {
    status?: LargeTransferReviewStatusValue;
    ownerUserId?: string;
    skip?: number;
    take?: number;
  }): Promise<{
    total: number;
    counts: Record<string, number>;
    items: Array<Record<string, unknown>>;
  }> {
    const where: Prisma.LargeTransferReviewWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.largeTransferReview.findMany({
        where,
        include: { asset: true },
        orderBy: { requestedAt: 'desc' },
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
      }),
      this.prisma.largeTransferReview.count({ where }),
    ]);
    const counts = await this.prisma.largeTransferReview.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return {
      total,
      counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])),
      items: items.map((item) => ({
        id: item.id,
        ownerUserId: item.ownerUserId,
        walletId: item.walletId,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        assetCode: item.asset.code,
        assetSymbol: item.asset.symbol,
        network: item.network,
        fromAddress: item.fromAddress,
        destinationAddress: item.destinationAddress,
        amount: item.amount.toFixed(),
        amountUsdCents: item.amountUsdCents.toString(),
        priceUsdCentsPerWhole: item.priceUsdCentsPerWhole?.toString() ?? null,
        priceTimestamp: item.priceTimestamp?.toISOString() ?? null,
        status: item.status,
        requestedAt: item.requestedAt.toISOString(),
        decisionAt: item.decisionAt?.toISOString() ?? null,
        decisionReason: item.decisionReason,
        rejectionReason: item.rejectionReason,
        metadata: item.metadata,
      })),
    };
  }

  async getReview(reviewId: string): Promise<Record<string, unknown>> {
    const item = await this.prisma.largeTransferReview.findUnique({
      where: { id: reviewId },
      include: { asset: true },
    });
    if (!item) throw new NotFoundError('Transaction review not found');
    return {
      id: item.id,
      ownerUserId: item.ownerUserId,
      walletId: item.walletId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      assetCode: item.asset.code,
      assetSymbol: item.asset.symbol,
      network: item.network,
      fromAddress: item.fromAddress,
      destinationAddress: item.destinationAddress,
      amount: item.amount.toFixed(),
      amountUsdCents: item.amountUsdCents.toString(),
      priceUsdCentsPerWhole: item.priceUsdCentsPerWhole?.toString() ?? null,
      priceTimestamp: item.priceTimestamp?.toISOString() ?? null,
      status: item.status,
      requestedAt: item.requestedAt.toISOString(),
      decisionAt: item.decisionAt?.toISOString() ?? null,
      decisionReason: item.decisionReason,
      rejectionReason: item.rejectionReason,
      metadata: item.metadata,
    };
  }

  async approveReview(reviewId: string, actorUserId: string, reason: string): Promise<unknown> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.largeTransferReview.updateMany({
        where: { id: reviewId, status: LargeTransferReviewStatus.PENDING },
        data: {
          status: LargeTransferReviewStatus.APPROVED,
          decisionAt: new Date(),
          decisionByUserId: actorUserId,
          decisionReason: reason,
        },
      });
      if (claimed.count !== 1) {
        const existing = await tx.largeTransferReview.findUnique({ where: { id: reviewId } });
        if (!existing) throw new NotFoundError('Transaction review not found');
        throw new ValidationError('Transaction review is no longer pending');
      }
      const review = await tx.largeTransferReview.findUniqueOrThrow({
        where: { id: reviewId },
        include: { asset: true },
      });
      if (review.sourceType === 'SIMULATION_TRANSACTION' && review.sourceId) {
        const simulationTx = await tx.simulationTransaction.findUnique({
          where: { id: review.sourceId },
        });
        if (simulationTx?.simulationBalanceId) {
          const balance = await tx.simulationBalance.findUnique({
            where: { id: simulationTx.simulationBalanceId },
          });
          if (!balance || balance.quantity.lessThan(simulationTx.amount)) {
            throw new ValidationError('Simulation balance became insufficient before approval');
          }
          await tx.simulationBalance.update({
            where: { id: balance.id },
            data: { quantity: balance.quantity.sub(simulationTx.amount) },
          });
        }
        if (simulationTx) {
          await tx.simulationTransaction.update({
            where: { id: review.sourceId },
            data: {
              status: SimulationTransactionStatus.COMPLETED,
              completedAt: new Date(),
            },
          });
        }
      }
      return review;
    });
    if (updated.sourceType === 'SIMULATION_TRANSACTION') {
      this.emitSimulationEvent(updated.ownerUserId, updated.asset.code, null, reason);
    }
    await this.recordAudit('LARGE_TRANSFER_REVIEW_APPROVED', actorUserId, updated.ownerUserId, {
      reason,
      reviewId,
      assetCode: updated.asset.code,
    });
    await this.adminEvents.publish({
      type: 'TRANSACTION_REVIEW_APPROVED',
      userId: updated.ownerUserId,
      targetId: reviewId,
      severity: 'info',
      metadata: { assetCode: updated.asset.code, network: updated.network },
    });
    return updated;
  }

  async rejectReview(reviewId: string, actorUserId: string, reason: string): Promise<unknown> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.largeTransferReview.updateMany({
        where: { id: reviewId, status: LargeTransferReviewStatus.PENDING },
        data: {
          status: LargeTransferReviewStatus.REJECTED,
          decisionAt: new Date(),
          decisionByUserId: actorUserId,
          rejectionReason: reason,
        },
      });
      if (claimed.count !== 1) {
        const existing = await tx.largeTransferReview.findUnique({ where: { id: reviewId } });
        if (!existing) throw new NotFoundError('Transaction review not found');
        throw new ValidationError('Transaction review is no longer pending');
      }
      const review = await tx.largeTransferReview.findUniqueOrThrow({
        where: { id: reviewId },
        include: { asset: true },
      });
      if (review.sourceType === 'SIMULATION_TRANSACTION' && review.sourceId) {
        await tx.simulationTransaction.update({
          where: { id: review.sourceId },
          data: {
            status: SimulationTransactionStatus.REJECTED,
            completedAt: new Date(),
          },
        });
      }
      return review;
    });
    await this.recordAudit('LARGE_TRANSFER_REVIEW_REJECTED', actorUserId, updated.ownerUserId, {
      reason,
      reviewId,
      assetCode: updated.asset.code,
    });
    await this.adminEvents.publish({
      type: 'TRANSACTION_REVIEW_REJECTED',
      userId: updated.ownerUserId,
      targetId: reviewId,
      severity: 'warning',
      metadata: { assetCode: updated.asset.code, network: updated.network },
    });
    return updated;
  }

  async reviewSummary(): Promise<{ pending: number; approved: number; rejected: number }> {
    const [pending, approved, rejected] = await Promise.all([
      this.prisma.largeTransferReview.count({
        where: { status: LargeTransferReviewStatus.PENDING },
      }),
      this.prisma.largeTransferReview.count({
        where: { status: LargeTransferReviewStatus.APPROVED },
      }),
      this.prisma.largeTransferReview.count({
        where: { status: LargeTransferReviewStatus.REJECTED },
      }),
    ]);
    return { pending, approved, rejected };
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  private async requireAsset(assetCode: string): Promise<AssetWithQuote> {
    const asset = await this.prisma.asset.findFirst({
      where: { code: assetCode, isActive: true },
      include: {
        marketMetadata: {
          include: {
            quotes: {
              where: { quoteCurrency: 'USD' },
              take: 1,
              orderBy: { asOf: 'desc' },
            },
          },
        },
      },
    });
    if (!asset) throw new NotFoundError(`Asset not found: ${assetCode}`);
    return {
      id: asset.id,
      code: asset.code,
      symbol: asset.symbol,
      name: asset.name,
      chain: asset.chain,
      decimals: asset.decimals,
      marketQuote: asset.marketMetadata?.quotes[0]
        ? {
            price: asset.marketMetadata.quotes[0].price,
            source: asset.marketMetadata.quotes[0].source,
            asOf: asset.marketMetadata.quotes[0].asOf,
          }
        : null,
    };
  }

  private async requireSimulationAccount(ownerUserId: string) {
    const account = await this.prisma.simulationAccount.findUnique({ where: { ownerUserId } });
    if (!account) throw new NotFoundError('Simulation account not found');
    return account;
  }

  private async requireActiveSimulationAccount(ownerUserId: string) {
    const account = await this.requireSimulationAccount(ownerUserId);
    if (account.status !== SimulationAccountStatus.ACTIVE) {
      throw new ValidationError('Test account is disabled');
    }
    return account;
  }

  private async requireSimulationBalance(simulationAccountId: string, assetId: string) {
    const balance = await this.prisma.simulationBalance.findFirst({
      where: { simulationAccountId, assetId },
    });
    if (!balance) {
      throw new ValidationError('Add a simulated asset before creating this scenario');
    }
    return balance;
  }

  private parseAmount(input: string): Decimal {
    const value = new Prisma.Decimal(input);
    if (value.lessThan(0)) {
      throw new ValidationError('Amount must be zero or greater');
    }
    return value;
  }

  private async recordAudit(
    action:
      | 'TEST_ACCOUNT_CLASSIFIED'
      | 'TEST_ACCOUNT_UNCLASSIFIED'
      | 'SIMULATION_BALANCE_CHANGED'
      | 'SIMULATION_PORTFOLIO_RESET'
      | 'SIMULATION_PRESET_APPLIED'
      | 'LARGE_TRANSFER_REVIEW_CREATED'
      | 'LARGE_TRANSFER_REVIEW_APPROVED'
      | 'LARGE_TRANSFER_REVIEW_REJECTED',
    actorUserId: string,
    targetUserId: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.securityAuditLog.create({
      data: {
        action: action as never,
        actorUserId,
        targetUserId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  private async recordSimulationEvent(input: {
    simulationAccountId: string;
    simulationBalanceId?: string;
    assetId?: string;
    eventType: SimulationBalanceEventTypeValue;
    previousQuantity?: Decimal;
    newQuantity?: Decimal;
    deltaQuantity?: Decimal;
    valuationUsd?: Decimal | null;
    reason: string;
    adminUserId: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.simulationBalanceEvent.create({
      data: {
        simulationAccountId: input.simulationAccountId,
        simulationBalanceId: input.simulationBalanceId,
        assetId: input.assetId,
        eventType: input.eventType,
        previousQuantity: input.previousQuantity,
        newQuantity: input.newQuantity,
        deltaQuantity: input.deltaQuantity,
        valuationUsd: input.valuationUsd ?? null,
        reason: input.reason,
        adminUserId: input.adminUserId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private emitSimulationEvent(
    ownerUserId: string,
    assetCode: string | null,
    quantity: string | null,
    reason: string,
  ) {
    void this.adminEvents.publish({
      type: 'SIMULATION_BALANCE_CHANGED',
      userId: ownerUserId,
      severity: 'info',
      metadata: {
        assetCode,
        quantity,
        reason,
      },
    });
  }

  private async valueUsd(asset: AssetWithQuote, quantity: Decimal): Promise<Decimal | null> {
    if (!asset.marketQuote) return null;
    return quantity.mul(asset.marketQuote.price).toDecimalPlaces(2);
  }

  private async latestPrice(asset: AssetWithQuote) {
    if (!asset.marketQuote) return null;
    return {
      usdCentsPerWholeToken: BigInt(asset.marketQuote.price.mul(100).round().toFixed(0)),
      timestamp: asset.marketQuote.asOf,
    };
  }

  private toSmallestUnit(amount: Decimal, decimals: number): bigint {
    const scale = new Prisma.Decimal(10).pow(decimals);
    return BigInt(amount.mul(scale).round().toFixed(0));
  }

  private presetHoldings(presetCode: string): Array<{ assetCode: string; quantity: string }> {
    const presets: Record<string, Array<{ assetCode: string; quantity: string }>> = {
      starter: [
        { assetCode: 'BTC', quantity: '0.25' },
        { assetCode: 'ETH', quantity: '4.5' },
        { assetCode: 'USDC', quantity: '2500' },
      ],
      high_net_worth: [
        { assetCode: 'BTC', quantity: '12' },
        { assetCode: 'ETH', quantity: '250' },
        { assetCode: 'SOL', quantity: '1500' },
        { assetCode: 'USDT', quantity: '500000' },
      ],
      low_balance: [
        { assetCode: 'BTC', quantity: '0.0012' },
        { assetCode: 'ETH', quantity: '0.04' },
      ],
      large_transfer_review: [
        { assetCode: 'BTC', quantity: '1.5' },
        { assetCode: 'ETH', quantity: '18' },
      ],
      insufficient_funds: [{ assetCode: 'USDC', quantity: '25' }],
      network_congestion: [
        { assetCode: 'ETH', quantity: '6.25' },
        { assetCode: 'POL', quantity: '2200' },
      ],
    };
    const preset = presets[presetCode];
    if (!preset) {
      throw new ValidationError(`Unknown simulation preset: ${presetCode}`);
    }
    return preset;
  }
}
