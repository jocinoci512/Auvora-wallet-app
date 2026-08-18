import { Inject, Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@auvora/database';
import {
  ADMIN_EVENT_PUBLISHER,
  type AdminEventPublisherPort,
} from '../../infrastructure/realtime/admin-event-publisher.adapter';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain';
import {
  USER_TRANSFER_SOURCE_TYPE,
  blocksUnauditedBroadcast,
  evaluateLargeTransferUsdCents,
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
    const decision = evaluateLargeTransferUsdCents({
      amountSmallest: this.toSmallestUnit(amount, asset.decimals),
      decimals: asset.decimals,
      usdCentsPerWholeToken: price.usdCentsPerWholeToken,
      priceAt: price.timestamp,
    });

    if (!blocksUnauditedBroadcast(decision.status)) {
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

    const created = await this.createReview({
      input,
      wallet,
      asset,
      amount,
      decisionStatus: decision.status,
      notionalUsdCents: decision.notionalUsdCents ?? 0n,
      price,
      message: decision.message ?? 'This transfer requires administrator review before signing.',
    });
    return created;
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
    return {
      allowed: false,
      status: decisionStatus,
      reviewId: review.id,
      reviewStatus: review.status,
      requestedAt: review.requestedAt.toISOString(),
      message: 'Transaction pending review',
      amountUsdCents: review.amountUsdCents.toString(),
      assetCode,
      network,
    };
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
