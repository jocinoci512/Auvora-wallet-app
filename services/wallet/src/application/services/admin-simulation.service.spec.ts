import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@auvora/database';
import { NotFoundError, ValidationError } from '../../domain';
import { AdminSimulationService } from './admin-simulation.service';

const serviceSrc = readFileSync(join(__dirname, 'admin-simulation.service.ts'), 'utf8');
const controllerSrc = readFileSync(
  join(__dirname, '../../presentation/controllers/admin-simulation.controller.ts'),
  'utf8',
);
const walletsSrc = readFileSync(
  join(__dirname, '../../presentation/controllers/admin-wallets.controller.ts'),
  'utf8',
);

function createService(prisma: Record<string, unknown>) {
  const adminEvents = { publish: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new AdminSimulationService(prisma as never, adminEvents as never),
    adminEvents,
  };
}

describe('admin simulation security', () => {
  it('never broadcasts, signs, or mutates real wallet balances in source', () => {
    expect(serviceSrc).not.toMatch(/broadcast/i);
    expect(serviceSrc).not.toMatch(/signTransaction|privateKey|mnemonic|seedPhrase/);
    expect(serviceSrc).not.toMatch(/walletBalance|creditWallet|debitWallet|ledgerEntry/);
    expect(controllerSrc).toContain('@Permissions(PERMISSION_SIMULATION_READ)');
    expect(controllerSrc).toContain('@Permissions(PERMISSION_SIMULATION_MANAGE)');
    expect(controllerSrc).toContain('@RequireStepUp()');
    expect(controllerSrc).toContain('@Roles(...ADMIN_PORTAL_ROLES)');
  });

  it('removed admin credit/debit/transfer mutation routes from real wallets', () => {
    expect(walletsSrc).not.toMatch(/credit|debit|transfer/i);
    expect(walletsSrc).toContain('@Permissions(PERMISSION_WALLETS_READ)');
  });

  it('rejects simulated balances for users who are not active TEST accounts', async () => {
    const prisma = {
      simulationAccount: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      walletBalance: {
        update: jest.fn(),
      },
    };
    const { service } = createService(prisma);
    await expect(
      service.upsertBalance({
        ownerUserId: '11111111-1111-4111-8111-111111111111',
        assetCode: 'BTC',
        operation: 'set',
        amount: '1',
        actorUserId: 'admin-1',
        reason: 'qa simulation',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.walletBalance.update).not.toHaveBeenCalled();
  });

  it('rejects simulated balances when the TEST account is disabled', async () => {
    const prisma = {
      simulationAccount: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sim-1',
          ownerUserId: 'user-1',
          status: 'DISABLED',
        }),
      },
    };
    const { service } = createService(prisma);
    await expect(
      service.upsertBalance({
        ownerUserId: 'user-1',
        assetCode: 'BTC',
        operation: 'increase',
        amount: '1',
        actorUserId: 'admin-1',
        reason: 'qa simulation',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('writes only simulation tables and an audit event when a TEST balance changes', async () => {
    const account = { id: 'sim-1', ownerUserId: 'user-1', status: 'ACTIVE' };
    const asset = {
      id: 'asset-1',
      code: 'BTC',
      symbol: 'BTC',
      name: 'Bitcoin',
      chain: 'BITCOIN',
      decimals: 8,
      isActive: true,
      marketMetadata: null,
    };
    const prisma: Record<string, unknown> = {
      simulationAccount: {
        findUnique: jest.fn().mockResolvedValue(account),
      },
      asset: {
        findFirst: jest.fn().mockResolvedValue(asset),
      },
      simulationBalance: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'bal-1',
          quantity: new Prisma.Decimal('1'),
        }),
        update: jest.fn(),
      },
      securityAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      simulationBalanceEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
      user: {
        findUnique: jest.fn(),
      },
    };
    const { service, adminEvents } = createService(prisma);
    jest.spyOn(service, 'getSimulationAccount').mockResolvedValue({
      id: account.id,
      ownerUserId: account.ownerUserId,
      status: account.status,
      balances: [],
    });

    await service.upsertBalance({
      ownerUserId: 'user-1',
      assetCode: 'BTC',
      operation: 'set',
      amount: '1',
      actorUserId: 'admin-1',
      reason: 'seed test funds',
    });

    expect((prisma.simulationBalance as { create: jest.Mock }).create).toHaveBeenCalled();
    expect((prisma.securityAuditLog as { create: jest.Mock }).create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'SIMULATION_BALANCE_CHANGED' }),
      }),
    );
    expect(adminEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'SIMULATION_BALANCE_CHANGED' }),
    );
    expect(prisma).not.toHaveProperty('walletBalance');
  });

  it('claims pending reviews atomically and rejects duplicate approve/reject', async () => {
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn(prisma),
      ),
      largeTransferReview: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'rev-1',
          status: 'APPROVED',
          ownerUserId: 'user-1',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'rev-1',
          ownerUserId: 'user-1',
          sourceType: 'USER_TRANSFER',
          sourceId: null,
          asset: { code: 'BTC' },
          network: 'BITCOIN',
        }),
      },
      securityAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const { service, adminEvents } = createService(prisma);

    await service.approveReview('rev-1', 'admin-1', 'approved after review');
    await expect(
      service.approveReview('rev-1', 'admin-1', 'duplicate approve'),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.rejectReview('rev-1', 'admin-1', 'cannot reject after approve'),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(adminEvents.publish).toHaveBeenCalledTimes(1);
    expect(adminEvents.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'TRANSACTION_REVIEW_APPROVED' }),
    );
  });

  it('does not touch simulation balances when approving a real-source review', async () => {
    const prisma = {
      $transaction: jest.fn(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) =>
        fn(prisma),
      ),
      largeTransferReview: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'rev-2',
          ownerUserId: 'user-1',
          sourceType: 'USER_TRANSFER',
          sourceId: 'tx-real',
          asset: { code: 'ETH' },
          network: 'ETHEREUM',
        }),
      },
      simulationBalance: {
        update: jest.fn(),
      },
      simulationTransaction: {
        update: jest.fn(),
      },
      securityAuditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-2' }),
      },
    };
    const { service } = createService(prisma);
    await service.approveReview('rev-2', 'admin-1', 'allow user to sign locally');
    expect((prisma.simulationBalance as { update: jest.Mock }).update).not.toHaveBeenCalled();
    expect((prisma.simulationTransaction as { update: jest.Mock }).update).not.toHaveBeenCalled();
  });
});
