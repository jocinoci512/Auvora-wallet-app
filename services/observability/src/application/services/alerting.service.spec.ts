import { AlertingService } from './alerting.service';

describe('AlertingService', () => {
  it('fires alert when threshold breached', async () => {
    const prisma = {
      obsAlertRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'r1',
            code: 'api_latency',
            name: 'API latency',
            metricCode: 'http_latency_ms',
            threshold: 200,
            comparison: 'gt',
            windowSeconds: 300,
            severity: 'WARNING',
            isEnabled: true,
          },
        ]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      obsMetricDefinition: {
        findUnique: jest.fn().mockResolvedValue({ id: 'm1', code: 'http_latency_ms' }),
      },
      obsMetricSample: {
        findMany: jest.fn().mockResolvedValue([
          { value: 250, serviceName: 'gateway' },
          { value: 300, serviceName: 'gateway' },
        ]),
      },
      obsAlert: {
        create: jest.fn().mockResolvedValue({ id: 'a1' }),
      },
    };
    const audit = { record: jest.fn() };
    const service = new AlertingService(prisma as never, audit as never);
    const result = await service.evaluateEnabledRules();
    expect(result.fired).toBe(1);
    expect(prisma.obsAlert.create).toHaveBeenCalled();
  });

  it('updates alert rule without code changes', async () => {
    const prisma = {
      obsAlertRule: {
        findUnique: jest.fn().mockResolvedValue({ id: 'r1', code: 'api_latency' }),
        update: jest.fn().mockResolvedValue({
          id: 'r1',
          code: 'api_latency',
          isEnabled: false,
          threshold: 500,
        }),
      },
    };
    const audit = { record: jest.fn() };
    const service = new AlertingService(prisma as never, audit as never);
    const updated = await service.updateRule('api_latency', { isEnabled: false, threshold: 500 });
    expect(updated.isEnabled).toBe(false);
    expect(updated.threshold).toBe(500);
    expect(audit.record).toHaveBeenCalledWith('alert_rule.updated', expect.any(Object));
  });
});
