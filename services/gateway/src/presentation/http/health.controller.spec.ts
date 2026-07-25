import { HealthStatus } from '@auvora/types';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok liveness payload', () => {
    const controller = new HealthController();
    const result = controller.getHealth();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.service).toBe('gateway');
    expect(typeof result.uptimeSeconds).toBe('number');
  });

  it('returns readiness payload with checks', async () => {
    const controller = new HealthController();
    const result = await controller.getReady();
    expect(result.checks?.process).toBe(HealthStatus.Ok);
    expect(result.checks?.auth).toBeDefined();
  });
});
