import { LimitWindow } from '@auvora/database';
import { LimitExceededError } from '../../domain';
import type { LimitRepositoryPort, PaymentLimitRecord } from '../ports/limit-repository.port';
import type { PaymentRepositoryPort } from '../ports/payment-repository.port';
import { LimitsService } from './limits.service';

function makeLimit(overrides: Partial<PaymentLimitRecord> = {}): PaymentLimitRecord {
  return {
    id: 'limit-1',
    window: LimitWindow.PER_TRANSACTION,
    amount: '1000',
    currency: 'USD',
    assetCode: null,
    ownerUserId: 'user-1',
    accountTier: null,
    country: null,
    riskProfile: null,
    isEnabled: true,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('LimitsService', () => {
  function makeService(limits: PaymentLimitRecord[], sumTotal = '0') {
    const limitRepository: jest.Mocked<LimitRepositoryPort> = {
      create: jest.fn(),
      findById: jest.fn(),
      list: jest.fn(),
      findApplicable: jest.fn().mockResolvedValue(limits),
      update: jest.fn(),
    };
    const paymentRepository: Partial<jest.Mocked<PaymentRepositoryPort>> = {
      sumAmountSince: jest.fn().mockResolvedValue({ count: 1, total: sumTotal }),
    };
    const service = new LimitsService(
      limitRepository,
      paymentRepository as PaymentRepositoryPort,
    );
    return { service, limitRepository, paymentRepository };
  }

  it('allows a payment within the per-transaction limit', async () => {
    const { service } = makeService([makeLimit({ amount: '1000' })]);
    await expect(
      service.evaluate({ ownerUserId: 'user-1', amount: '500', currency: 'USD' }),
    ).resolves.toBeUndefined();
  });

  it('rejects a payment exceeding the per-transaction limit', async () => {
    const { service } = makeService([makeLimit({ amount: '1000' })]);
    await expect(
      service.evaluate({ ownerUserId: 'user-1', amount: '1500', currency: 'USD' }),
    ).rejects.toThrow(LimitExceededError);
  });

  it('skips limits scoped to a different currency', async () => {
    const { service } = makeService([makeLimit({ amount: '100', currency: 'EUR' })]);
    await expect(
      service.evaluate({ ownerUserId: 'user-1', amount: '5000', currency: 'USD' }),
    ).resolves.toBeUndefined();
  });

  it('skips disabled limits', async () => {
    const { service } = makeService([makeLimit({ amount: '100', isEnabled: false })]);
    await expect(
      service.evaluate({ ownerUserId: 'user-1', amount: '5000', currency: 'USD' }),
    ).resolves.toBeUndefined();
  });

  it('enforces a daily window limit against the running total plus the new amount', async () => {
    const { service } = makeService(
      [makeLimit({ window: LimitWindow.DAILY, amount: '1000' })],
      '600',
    );
    await expect(
      service.evaluate({ ownerUserId: 'user-1', amount: '500', currency: 'USD' }),
    ).rejects.toThrow(LimitExceededError);
  });

  it('allows a daily window payment that keeps the running total under the limit', async () => {
    const { service } = makeService(
      [makeLimit({ window: LimitWindow.DAILY, amount: '1000' })],
      '200',
    );
    await expect(
      service.evaluate({ ownerUserId: 'user-1', amount: '500', currency: 'USD' }),
    ).resolves.toBeUndefined();
  });

  it('listForUser delegates to findApplicable scoped to the owner', async () => {
    const limit = makeLimit();
    const { service, limitRepository } = makeService([limit]);
    const result = await service.listForUser('user-1');
    expect(result).toEqual([limit]);
    expect(limitRepository.findApplicable).toHaveBeenCalledWith({
      ownerUserId: 'user-1',
      accountTier: 'standard',
    });
  });

  it('fails closed when no applicable limits are configured', async () => {
    const { service } = makeService([]);
    await expect(
      service.evaluate({ ownerUserId: 'user-1', amount: '1', currency: 'USD' }),
    ).rejects.toThrow(LimitExceededError);
  });
});
