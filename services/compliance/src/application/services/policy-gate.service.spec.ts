import { PolicyGateService } from './policy-gate.service';
import { RulesEngineService } from './rules-engine.service';

describe('PolicyGateService', () => {
  it('blocks when fraud provider denies', async () => {
    const prisma = {
      kycProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      amlAlert: { count: jest.fn().mockResolvedValue(0), create: jest.fn() },
      complianceRule: { findMany: jest.fn().mockResolvedValue([]) },
      complianceCase: { create: jest.fn() },
    };
    const events = { publish: jest.fn() };
    const fraud = {
      evaluate: jest.fn().mockResolvedValue({
        allow: false,
        riskScore: 95,
        reasons: ['simulated'],
      }),
    };
    const service = new PolicyGateService(
      prisma as never,
      new RulesEngineService(),
      fraud as never,
      events as never,
      { uuid: () => '00000000-0000-4000-8000-000000000099' } as never,
    );

    const result = await service.evaluatePayment({
      ownerUserId: '00000000-0000-4000-8000-000000000001',
      amount: '100',
      currency: 'USD',
    });

    expect(result.allow).toBe(false);
    expect(result.reasons).toContain('simulated');
    expect(events.publish).toHaveBeenCalled();
  });

  it('creates alert when high-value rule matches', async () => {
    const createdAlert = { id: 'alert-1' };
    const prisma = {
      kycProfile: { findUnique: jest.fn().mockResolvedValue({ riskScore: 20, country: 'US', level: 'BASIC' }) },
      amlAlert: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(createdAlert),
        update: jest.fn(),
      },
      complianceRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            code: 'high-value-tx',
            name: 'High value',
            action: 'FLAG',
            expression: { field: 'amount', op: 'gte', value: 10000 },
            isEnabled: true,
            priority: 10,
          },
        ]),
      },
      complianceCase: { create: jest.fn() },
    };
    const events = { publish: jest.fn() };
    const fraud = {
      evaluate: jest.fn().mockResolvedValue({ allow: true, riskScore: 20, reasons: [] }),
    };
    const service = new PolicyGateService(
      prisma as never,
      new RulesEngineService(),
      fraud as never,
      events as never,
      { uuid: () => 'case-id' } as never,
    );

    const result = await service.evaluatePayment({
      ownerUserId: '00000000-0000-4000-8000-000000000001',
      amount: '15000',
      currency: 'USD',
    });

    expect(result.allow).toBe(true);
    expect(result.matchedRules[0]?.code).toBe('high-value-tx');
    expect(prisma.amlAlert.create).toHaveBeenCalled();
    expect(result.alertIds).toEqual(['alert-1']);
  });
});
