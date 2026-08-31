import { Inject, Injectable, Optional } from '@nestjs/common';
import { Prisma, PrismaService } from '@auvora/database';
import {
  ADMIN_EVENT_PUBLISHER,
  type AdminEventPublisherPort,
} from '../../infrastructure/realtime/admin-event-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain';
import {
  USER_TRANSFER_SOURCE_TYPE,
  blocksUnauditedBroadcast,
  evaluateLargeTransferUsdCents,
  isKycApprovedStatus,
  resolveKycRequiredThresholdCents,
  resolveLargeTransferThresholdCents,
  resolveQaNotionalUsdCents,
} from '../../domain/large-transfer-review';
import {
  WALLET_REPOSITORY,
  type WalletRecord,
  type WalletRepositoryPort,
} from '../ports/wallet-repository.port';

type Decimal = Prisma.Decimal;

const LargeTransferReviewStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;

type AssetWithQuote = {
  id: string;
  code: string;
  symbol: string;
  chain: string;
  decimals: number;
  marketQuote: {
    price: Decimal;
    source: string;
    asOf: Date;
  } | null;
};

export interface PrepareTransferInput {
  ownerUserId: string;
  walletId?: string;
  assetCode: string;
  destinationAddress: string;
  amount: string;
  fromAddress?: string;
  idempotencyKey: string;
  /** Safe environment marker from self-custody clients (`mainnet` | `testnet`). */
  networkEnv?: string;
  /** Local QA only. Ignored unless AUVORA_QA_TRANSFER_VALUATION=true and testnet. */
  qaNotionalUsdCents?: string;
}

export interface PrepareTransferResult {
  allowed: boolean;
  status: string;
  reviewId: string | null;
  reviewStatus: string | null;
  requestedAt: string | null;
  message: string;
  amountUsdCents: string | null;
  assetCode: string;
  network: string;
}

@Injectable()
export class TransferPrepareService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WALLET_REPOSITORY) private readonly wallets: WalletRepositoryPort,
    @Inject(ADMIN_EVENT_PUBLISHER) private readonly adminEvents: AdminEventPublisherPort,
    @Optional()
    @Inject(NOTIFICATIONS_PUBLISHER)
    private readonly notifications?: NotificationsPublisherPort,
  ) {}

  async prepare(input: PrepareTransferInput): Promise<PrepareTransferResult> {
    const amount = this.parseAmount(input.amount);
    const wallet = await this.resolveWallet(input);
    if (wallet && wallet.assetCode !== input.assetCode) {
      throw new ValidationError('Wallet asset does not match the requested asset');
    }
    const asset = await this.requireAsset(wallet?.assetId ?? null, input.assetCode);

    const existing = await this.prisma.largeTransferReview.findFirst({
      where: {
        sourceType: USER_TRANSFER_SOURCE_TYPE,
        sourceId: input.idempotencyKey,
      },
    });
    if (existing) {
      return this.toReplayResult(existing, asset.code, asset.chain);
    }

    const price = this.latestPrice(asset);
    const qaNotional = resolveQaNotionalUsdCents({
      networkEnv: input.networkEnv,
      raw: input.qaNotionalUsdCents,
    });
    const decision = evaluateLargeTransferUsdCents({
      amountSmallest: this.toSmallestUnit(amount, asset.decimals),
      decimals: asset.decimals,
      usdCentsPerWholeToken: price.usdCentsPerWholeToken,
      priceAt: price.timestamp,
      thresholdCents: resolveLargeTransferThresholdCents(input.networkEnv),
      kycThresholdCents: resolveKycRequiredThresholdCents(input.networkEnv),
      ...(qaNotional != null ? { notionalUsdCentsOverride: qaNotional } : {}),
    });

    if (!blocksUnauditedBroadcast(decision.status)) {
      await this.expirePriceFailurePendings(input.ownerUserId);
      return {
        allowed: true,
        status: decision.status,
        reviewId: null,
        reviewStatus: null,
        requestedAt: null,
        message: 'Transfer is below the review threshold.',
        amountUsdCents: decision.notionalUsdCents?.toString() ?? null,
        assetCode: asset.code,
        network: asset.chain,
      };
    }

    // Price failures fail closed into a persisted review (existing behavior).
    if (decision.status === 'price_unavailable' || decision.status === 'stale_price') {
      return this.createReview({
        input,
        wallet,
        asset,
        amount,
        decisionStatus: decision.status,
        notionalUsdCents: decision.notionalUsdCents ?? 0n,
        price,
        message: 'This transaction is pending review.',
      });
    }

    if (decision.requiresKyc) {
      const kycOk = await this.ownerHasApprovedKyc(input.ownerUserId);
      if (!kycOk) {
        return {
          allowed: false,
          status: 'kyc_required',
          reviewId: null,
          reviewStatus: null,
          requestedAt: null,
          message: 'Identity verification required',
          amountUsdCents: decision.notionalUsdCents?.toString() ?? null,
          assetCode: asset.code,
          network: asset.chain,
        };
      }
    }

    // KYC-only band ($5k–$9,999.99): approved KYC, no Admin review solely for threshold.
    if (decision.status === 'kyc_required') {
      await this.expirePriceFailurePendings(input.ownerUserId);
      return {
        allowed: true,
        status: 'kyc_satisfied',
        reviewId: null,
        reviewStatus: null,
        requestedAt: null,
        message: 'Identity verification is complete. Transfer may continue.',
        amountUsdCents: decision.notionalUsdCents?.toString() ?? null,
        assetCode: asset.code,
        network: asset.chain,
      };
    }

    return this.createReview({
      input,
      wallet,
      asset,
      amount,
      decisionStatus: decision.status,
      notionalUsdCents: decision.notionalUsdCents ?? 0n,
      price,
      message: 'This transaction is pending review.',
    });
  }

  /** Soft FK: KycProfile.ownerUserId matches auth User id. No secrets. */
  private async ownerHasApprovedKyc(ownerUserId: string): Promise<boolean> {
    const profile = await this.prisma.kycProfile.findUnique({
      where: { ownerUserId },
      select: { status: true },
    });
    return isKycApprovedStatus(profile?.status);
  }

  private async createReview(args: {
    input: PrepareTransferInput;
    wallet: WalletRecord | null;
    asset: AssetWithQuote;
    amount: Decimal;
    decisionStatus: string;
    notionalUsdCents: bigint;
    price: {
      usdCentsPerWholeToken: bigint | null;
      timestamp: Date | null;
      source: string | null;
    };
    message: string;
  }): Promise<PrepareTransferResult> {
    try {
      const review = await this.prisma.largeTransferReview.create({
        data: {
          ownerUserId: args.input.ownerUserId,
          walletId: args.wallet?.id ?? null,
          assetId: args.asset.id,
          sourceType: USER_TRANSFER_SOURCE_TYPE,
          sourceId: args.input.idempotencyKey,
          network: args.asset.chain,
          fromAddress: args.input.fromAddress ?? null,
          destinationAddress: args.input.destinationAddress,
          amount: args.amount,
          amountUsdCents: args.notionalUsdCents,
          priceUsdCentsPerWhole: args.price.usdCentsPerWholeToken,
          priceTimestamp: args.price.timestamp,
          status: LargeTransferReviewStatus.PENDING,
          requestedByUserId: args.input.ownerUserId,
          metadata: {
            label: 'AUVORA_TRANSFER',
            simulated: false,
            decisionStatus: args.decisionStatus,
            priceSource: args.price.source,
            assetCode: args.asset.code,
            assetSymbol: args.asset.symbol,
            amountCrypto: args.amount.toFixed(),
            ...(args.input.networkEnv ? { networkEnv: args.input.networkEnv } : {}),
            ...(resolveQaNotionalUsdCents({
              networkEnv: args.input.networkEnv,
              raw: args.input.qaNotionalUsdCents,
            }) != null
              ? { qaValuation: true }
              : {}),
          },
        },
      });
      await this.prisma.securityAuditLog.create({
        data: {
          action: 'LARGE_TRANSFER_REVIEW_CREATED' as never,
          actorUserId: args.input.ownerUserId,
          targetUserId: args.input.ownerUserId,
          metadata: {
            reviewId: review.id,
            sourceType: USER_TRANSFER_SOURCE_TYPE,
            assetCode: args.asset.code,
            decisionStatus: args.decisionStatus,
          } as Prisma.InputJsonValue,
        },
      });
      await this.adminEvents.publish({
        type: 'TRANSACTION_REVIEW_CREATED',
        userId: args.input.ownerUserId,
        targetId: review.id,
        severity: 'warning',
        metadata: {
          assetCode: args.asset.code,
          network: args.asset.chain,
          simulated: false,
          sourceType: USER_TRANSFER_SOURCE_TYPE,
          status: review.status,
        },
      });
      await this.notifications?.publishEvent({
        eventType: 'wallet.transfer_review.pending',
        aggregateId: review.id,
        payload: {
          ownerUserId: args.input.ownerUserId,
          assetCode: args.asset.code,
          network: args.asset.chain,
          amountUsdCents: args.notionalUsdCents.toString(),
          decisionStatus: args.decisionStatus,
        },
      });
      if (args.decisionStatus === 'review_required') {
        await this.expirePriceFailurePendings(args.input.ownerUserId, review.id);
      }
      return {
        allowed: false,
        status: args.decisionStatus,
        reviewId: review.id,
        reviewStatus: review.status,
        requestedAt: review.requestedAt.toISOString(),
        message: args.message,
        amountUsdCents: args.notionalUsdCents.toString(),
        assetCode: args.asset.code,
        network: args.asset.chain,
      };
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const replay = await this.prisma.largeTransferReview.findFirst({
        where: {
          sourceType: USER_TRANSFER_SOURCE_TYPE,
          sourceId: args.input.idempotencyKey,
        },
      });
      if (!replay) throw error;
      return this.toReplayResult(replay, args.asset.code, args.asset.chain);
    }
  }

  private toReplayResult(
    review: {
      id: string;
      status: string;
      requestedAt: Date;
      amountUsdCents: bigint;
      metadata: Prisma.JsonValue | null;
    },
    assetCode: string,
    network: string,
  ): PrepareTransferResult {
    const metadata =
      review.metadata && typeof review.metadata === 'object' && !Array.isArray(review.metadata)
        ? (review.metadata as Record<string, unknown>)
        : {};
    const decisionStatus =
      typeof metadata.decisionStatus === 'string' ? metadata.decisionStatus : 'review_required';
    const customerReason =
      typeof metadata.customerVisibleReason === 'string' ? metadata.customerVisibleReason : null;
    let message = 'This transaction is pending review.';
    if (review.status === 'REJECTED') {
      message = customerReason ?? 'This transaction was declined.';
    } else if (review.status === 'APPROVED') {
      message = 'Approved. You can continue when you are ready.';
    }
    return {
      allowed: false,
      status: decisionStatus,
      reviewId: review.id,
      reviewStatus: review.status,
      requestedAt: review.requestedAt.toISOString(),
      message,
      amountUsdCents: review.amountUsdCents.toString(),
      assetCode,
      network,
    };
  }

  toCustomerReview(review: {
    id: string;
    status: string;
    rejectionReason: string | null;
    requestedAt: Date;
    decisionAt: Date | null;
    amountUsdCents: bigint;
    network: string;
    destinationAddress: string;
    metadata: Prisma.JsonValue;
  }) {
    const meta =
      review.metadata && typeof review.metadata === 'object' && !Array.isArray(review.metadata)
        ? (review.metadata as Record<string, unknown>)
        : {};
    const customerReason =
      review.rejectionReason ??
      (typeof meta.customerVisibleReason === 'string' ? meta.customerVisibleReason : null);
    let customerStatus = 'Pending review';
    let message = 'This transaction is pending review.';
    if (review.status === 'REJECTED') {
      customerStatus = 'Declined';
      message = customerReason ?? 'This transaction was declined.';
    } else if (review.status === 'APPROVED') {
      customerStatus = 'Approved';
      message = 'Approved. You can continue when you are ready.';
    } else if (review.status === 'EXPIRED') {
      customerStatus = 'Failed';
      message = 'This review is no longer active.';
    }
    return {
      reviewId: review.id,
      status: review.status,
      customerStatus,
      message,
      customerReason,
      requestedAt: review.requestedAt.toISOString(),
      decidedAt: review.decisionAt?.toISOString() ?? null,
      amountUsdCents: review.amountUsdCents.toString(),
      network: review.network,
    };
  }

  async listMine(ownerUserId: string) {
    const items = await this.prisma.largeTransferReview.findMany({
      where: { ownerUserId, sourceType: USER_TRANSFER_SOURCE_TYPE },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });
    return items.map((row) => this.toCustomerReview(row));
  }

  async getMine(ownerUserId: string, reviewId: string) {
    const review = await this.prisma.largeTransferReview.findFirst({
      where: { id: reviewId, ownerUserId },
    });
    if (!review) throw new NotFoundError('Review not found');
    return this.toCustomerReview(review);
  }

  /**
   * Close leftover PENDING reviews created when USD price was missing/stale.
   * Does not expire genuine threshold reviews. Does not delete rows or audit events.
   */
  async expirePriceFailurePendings(ownerUserId: string, keepReviewId?: string): Promise<number> {
    const pending = await this.prisma.largeTransferReview.findMany({
      where: {
        ownerUserId,
        sourceType: USER_TRANSFER_SOURCE_TYPE,
        status: LargeTransferReviewStatus.PENDING,
        ...(keepReviewId ? { NOT: { id: keepReviewId } } : {}),
      },
    });
    let expired = 0;
    for (const row of pending) {
      const meta =
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {};
      const decision = typeof meta.decisionStatus === 'string' ? meta.decisionStatus : '';
      if (decision !== 'stale_price' && decision !== 'price_unavailable') continue;
      await this.prisma.largeTransferReview.update({
        where: { id: row.id },
        data: {
          status: LargeTransferReviewStatus.EXPIRED,
          decisionAt: new Date(),
          decisionReason: 'Superseded after a later valid prepare. Audit history preserved.',
          metadata: {
            ...meta,
            superseded: true,
            closedReason: 'Superseded stale-price review',
          } as Prisma.InputJsonValue,
        },
      });
      expired += 1;
    }
    return expired;
  }

  private async resolveWallet(input: PrepareTransferInput): Promise<WalletRecord | null> {
    if (input.walletId) {
      const wallet = await this.wallets.findById(input.walletId);
      if (!wallet) throw new NotFoundError('Wallet not found');
      if (wallet.ownerUserId !== input.ownerUserId) {
        throw new ForbiddenError('Wallet does not belong to the authenticated user');
      }
      return wallet;
    }
    const owned = await this.wallets.listByOwner(input.ownerUserId, 0, 100);
    return owned.items.find((item) => item.assetCode === input.assetCode) ?? null;
  }

  private async requireAsset(assetId: string | null, assetCode: string): Promise<AssetWithQuote> {
    const asset = assetId
      ? await this.prisma.asset.findUnique({
          where: { id: assetId },
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
        })
      : await this.prisma.asset.findFirst({
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
    if (!asset) {
      throw new NotFoundError(`Asset not found: ${assetCode}`);
    }
    if (asset.code !== assetCode) {
      throw new ValidationError('Wallet asset does not match the requested asset');
    }
    return {
      id: asset.id,
      code: asset.code,
      symbol: asset.symbol,
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

  private parseAmount(input: string): Decimal {
    const trimmed = input.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) {
      throw new ValidationError('Amount is malformed.');
    }
    const value = new Prisma.Decimal(trimmed);
    if (value.lte(0)) {
      throw new ValidationError('Amount must be greater than zero');
    }
    return value;
  }

  private latestPrice(asset: AssetWithQuote): {
    usdCentsPerWholeToken: bigint | null;
    timestamp: Date | null;
    source: string | null;
  } {
    if (!asset.marketQuote) {
      return { usdCentsPerWholeToken: null, timestamp: null, source: null };
    }
    const asOf = asset.marketQuote.asOf;
    if (!(asOf instanceof Date) || Number.isNaN(asOf.getTime())) {
      return { usdCentsPerWholeToken: null, timestamp: null, source: asset.marketQuote.source };
    }
    try {
      const cents = BigInt(asset.marketQuote.price.mul(100).round().toFixed(0));
      if (cents <= 0n) {
        return { usdCentsPerWholeToken: null, timestamp: asOf, source: asset.marketQuote.source };
      }
      return {
        usdCentsPerWholeToken: cents,
        timestamp: asOf,
        source: asset.marketQuote.source,
      };
    } catch {
      return { usdCentsPerWholeToken: null, timestamp: null, source: null };
    }
  }

  private toSmallestUnit(amount: Decimal, decimals: number): bigint {
    const scale = new Prisma.Decimal(10).pow(decimals);
    return BigInt(amount.mul(scale).round().toFixed(0));
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }
}
