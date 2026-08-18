import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@auvora/database';
import { ForbiddenError, NotFoundError } from '../../domain';
import { TransferPrepareService } from './transfer-prepare.service';

const serviceSrc = readFileSync(join(__dirname, 'transfer-prepare.service.ts'), 'utf8');
const controllerSrc = readFileSync(
  join(__dirname, '../../presentation/controllers/wallets.controller.ts'),
  'utf8',
);
const approveSrc = readFileSync(join(__dirname, 'admin-simulation.service.ts'), 'utf8');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const WALLET_ID = '22222222-2222-4222-8222-222222222222';
const ASSET_ID = '33333333-3333-4333-8333-333333333333';
const REVIEW_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY = '55555555-5555-4555-8555-555555555555';

function usdcAsset(quote?: { price: string; source: string; asOf: Date } | null) {
  return {
    id: ASSET_ID,
    code: 'USDC',
    symbol: 'USDC',
    chain: 'ETHEREUM',
    decimals: 6,
    isActive: true,
    marketMetadata:
      quote === undefined
        ? {
            quotes: [
              {
                price: new Prisma.Decimal('1'),
                source: 'market-data',
                asOf: new Date(),
              },
            ],
          }
        : quote
          ? {
              quotes: [
                { price: new Prisma.Decimal(quote.price), source: quote.source, asOf: quote.asOf },
              ],
            }
          : { quotes: [] },
  };
}

function walletRecord() {
  return {
    id: WALLET_ID,
    ownerUserId: USER_ID,
    assetId: ASSET_ID,
    assetCode: 'USDC',
    assetSymbol: 'USDC',
    assetDecimals: 6,
    assetChain: 'ETHEREUM',
    assetStandard: 'NATIVE',
    alias: null,
    label: null,
    status: 'ACTIVE',
    metadata: null,
    preferences: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
  };
}

function createService(overrides?: {
  prisma?: Record<string, unknown>;
  wallets?: Record<string, jest.Mock>;
}) {
  const createdReview = {
    id: REVIEW_ID,
    status: 'PENDING',
    requestedAt: new Date('2026-08-18T12:00:00.000Z'),
  };
  const prisma = {
    asset: {
      findUnique: jest.fn().mockResolvedValue(usdcAsset()),
      findFirst: jest.fn().mockResolvedValue(usdcAsset()),
    },
    largeTransferReview: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(createdReview),
    },
    securityAuditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    ...(overrides?.prisma ?? {}),
  };
  const wallets = {
    findById: jest.fn().mockResolvedValue(walletRecord()),
    listByOwner: jest.fn().mockResolvedValue({ items: [walletRecord()], total: 1 }),
    ...(overrides?.wallets ?? {}),
  };
  const adminEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new TransferPrepareService(prisma as never, wallets as never, adminEvents as never),
    prisma,
    wallets,
    adminEvents,
    createdReview,
  };
}

function prepareInput(amount: string) {
  return {
    ownerUserId: USER_ID,
    walletId: WALLET_ID,
    assetCode: 'USDC',
    destinationAddress: '0xabc',
    amount,
    fromAddress: '0xfrom',
    idempotencyKey: IDEMPOTENCY,
  };
}

describe('real user transfer prepare', () => {
  it('never signs, broadcasts, or exposes custody material', () => {
    expect(serviceSrc).not.toMatch(/broadcastTransaction|liveBroadcast|sendRawTransaction/i);
    expect(serviceSrc).not.toMatch(
      /signTransaction|privateKey|mnemonic|seedPhrase|unsignedPayload/,
    );
    expect(controllerSrc).toContain('transfers/prepare');
    expect(controllerSrc).not.toMatch(/broadcastTransaction|liveBroadcast|sendRawTransaction/i);
    expect(approveSrc).not.toMatch(/broadcastTransaction|liveBroadcast|sendRawTransaction/i);
    expect(approveSrc).not.toMatch(/signTransaction|privateKey|mnemonic|seedPhrase/);
  });

  it('does not create a review below $9,999.99', async () => {
    const { service, prisma, adminEvents } = createService();
    const result = await service.prepare(prepareInput('9999.99'));
    expect(result.allowed).toBe(true);
    expect(result.status).toBe('below_threshold');
    expect(result.reviewId).toBeNull();
    expect(result.amountUsdCents).toBe('999999');
    expect((prisma.largeTransferReview as { create: jest.Mock }).create).not.toHaveBeenCalled();
    expect(adminEvents.publish).not.toHaveBeenCalled();
  });

  it('creates a pending review at exactly $10,000.00', async () => {
    const { service, prisma, adminEvents } = createService();
    const result = await service.prepare(prepareInput('10000.00'));
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('review_required');
    expect(result.reviewId).toBe(REVIEW_ID);
    expect(result.reviewStatus).toBe('PENDING');
    expect(result.requestedAt).toBeTruthy();
    expect(result.message.toLowerCase()).toContain('review');
    expect((prisma.largeTransferReview as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
    expect((prisma.largeTransferReview as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceType: 'USER_TRANSFER',
          sourceId: IDEMPOTENCY,
          status: 'PENDING',
          amountUsdCents: 1_000_000n,
        }),
      }),
    );
    expect(adminEvents.publish).toHaveBeenCalledTimes(1);
    expect(adminEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TRANSACTION_REVIEW_CREATED',
        targetId: REVIEW_ID,
        metadata: expect.objectContaining({ simulated: false, sourceType: 'USER_TRANSFER' }),
      }),
    );
  });

  it('creates a pending review at $10,000.01', async () => {
    const { service } = createService();
    const result = await service.prepare(prepareInput('10000.01'));
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('review_required');
    expect(result.amountUsdCents).toBe('1000001');
  });

  it('returns the same review for duplicate preparation and emits one event', async () => {
    const existing = {
      id: REVIEW_ID,
      status: 'PENDING',
      requestedAt: new Date('2026-08-18T12:00:00.000Z'),
      amountUsdCents: 1_000_000n,
      metadata: { decisionStatus: 'review_required' },
    };
    const { service, prisma, adminEvents } = createService({
      prisma: {
        largeTransferReview: {
          findFirst: jest.fn().mockResolvedValue(existing),
          create: jest.fn(),
        },
      },
    });
    const first = await service.prepare(prepareInput('10000.00'));
    const second = await service.prepare(prepareInput('10000.00'));
    expect(first.reviewId).toBe(REVIEW_ID);
    expect(second.reviewId).toBe(REVIEW_ID);
    expect((prisma.largeTransferReview as { create: jest.Mock }).create).not.toHaveBeenCalled();
    expect(adminEvents.publish).not.toHaveBeenCalled();
  });

  it('collapses a create race onto the existing unique review', async () => {
    const replay = {
      id: REVIEW_ID,
      status: 'PENDING',
      requestedAt: new Date('2026-08-18T12:00:00.000Z'),
      amountUsdCents: 1_000_000n,
      metadata: { decisionStatus: 'review_required' },
    };
    const { service, prisma, adminEvents } = createService({
      prisma: {
        largeTransferReview: {
          findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(replay),
          create: jest.fn().mockRejectedValue({ code: 'P2002' }),
        },
      },
    });
    const result = await service.prepare(prepareInput('10000.00'));
    expect(result.reviewId).toBe(REVIEW_ID);
    expect((prisma.largeTransferReview as { create: jest.Mock }).create).toHaveBeenCalledTimes(1);
    expect(adminEvents.publish).not.toHaveBeenCalled();
  });

  it('fails closed and persists a review when USD price is missing', async () => {
    const { service, prisma } = createService({
      prisma: {
        asset: {
          findUnique: jest.fn().mockResolvedValue(usdcAsset(null)),
          findFirst: jest.fn().mockResolvedValue(usdcAsset(null)),
        },
      },
    });
    const result = await service.prepare(prepareInput('1'));
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('price_unavailable');
    expect(result.reviewId).toBe(REVIEW_ID);
    expect((prisma.largeTransferReview as { create: jest.Mock }).create).toHaveBeenCalled();
  });

  it('fails closed and persists a review when USD price is stale', async () => {
    const { service } = createService({
      prisma: {
        asset: {
          findUnique: jest.fn().mockResolvedValue(
            usdcAsset({
              price: '1',
              source: 'market-data',
              asOf: new Date('2020-01-01T00:00:00.000Z'),
            }),
          ),
          findFirst: jest.fn(),
        },
      },
    });
    const result = await service.prepare(prepareInput('1'));
    expect(result.allowed).toBe(false);
    expect(result.status).toBe('stale_price');
    expect(result.reviewId).toBe(REVIEW_ID);
  });

  it('rejects preparation for a wallet owned by another user', async () => {
    const { service } = createService({
      wallets: {
        findById: jest.fn().mockResolvedValue({ ...walletRecord(), ownerUserId: 'other-user' }),
      },
    });
    await expect(service.prepare(prepareInput('10000.00'))).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects an unknown wallet id', async () => {
    const { service } = createService({
      wallets: { findById: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.prepare(prepareInput('10000.00'))).rejects.toBeInstanceOf(NotFoundError);
  });
});
