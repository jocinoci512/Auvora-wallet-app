import { ForbiddenError } from '../../domain';
import { RiskService } from './risk.service';

function makeService(overrides: { profile?: unknown } = {}) {
  const prisma = {
    kycProfile: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.profile !== undefined ? overrides.profile : { id: 'profile-1' },
        ),
      update: jest.fn().mockResolvedValue({}),
    },
    riskScoreRecord: {
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'risk-1', ...data }),
        ),
      findFirst: jest.fn().mockResolvedValue({ id: 'risk-1', score: 42 }),
      findMany: jest.fn().mockResolvedValue([{ id: 'risk-1', score: 42 }]),
    },
  };
  const provider = {
    getCode: () => 'local-risk-simulator',
    score: jest.fn().mockResolvedValue({ score: 62.5, band: 'MEDIUM', factors: { country: 20 } }),
  };
  const events = { publish: jest.fn() };
  const service = new RiskService(prisma as never, provider as never, events as never);
  return { service, prisma, provider, events };
}

describe('RiskService', () => {
  it('persists a risk score record using the provider result', async () => {
    const { service, prisma } = makeService();
    const result = await service.scoreCustomer({ ownerUserId: 'user-1', factors: { country: 20 } });
    expect(result).toMatchObject({ score: 62.5, band: 'MEDIUM' });
    expect(prisma.riskScoreRecord.create).toHaveBeenCalled();
  });

  it('updates the linked KYC profile risk band when one exists', async () => {
    const { service, prisma } = makeService();
    await service.scoreCustomer({ ownerUserId: 'user-1', factors: {} });
    expect(prisma.kycProfile.update).toHaveBeenCalledWith({
      where: { id: 'profile-1' },
      data: { riskScore: 62.5, riskBand: 'MEDIUM' },
    });
  });

  it('skips profile update when no KYC profile exists yet', async () => {
    const { service, prisma } = makeService({ profile: null });
    await service.scoreCustomer({ ownerUserId: 'user-1', factors: {} });
    expect(prisma.kycProfile.update).not.toHaveBeenCalled();
  });

  it('publishes a RiskScoreUpdated event', async () => {
    const { service, events } = makeService();
    await service.scoreCustomer({ ownerUserId: 'user-1', factors: {} });
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RiskScoreUpdated',
        payload: expect.objectContaining({ ownerUserId: 'user-1' }),
      }),
    );
  });

  it('allows a user to read their own latest risk score', async () => {
    const { service } = makeService();
    const result = await service.getOwn('user-1', {
      sub: 'user-1',
      email: 'a@b.com',
      sessionId: 's1',
      roles: [],
      permissions: [],
    });
    expect(result).toMatchObject({ score: 42 });
  });

  it('forbids reading another user risk score without admin permission', async () => {
    const { service } = makeService();
    await expect(
      service.getOwn('user-2', {
        sub: 'user-1',
        email: 'a@b.com',
        sessionId: 's1',
        roles: [],
        permissions: [],
      }),
    ).rejects.toThrow(ForbiddenError);
  });
});
