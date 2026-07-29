import { HealthStatus } from '@auvora/types';
import { HealthController } from './health.controller';

function mockRes() {
  const res = {
    statusCode: 200,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
  return res;
}

describe('HealthController', () => {
  it('returns ok liveness payload', () => {
    const controller = new HealthController();
    const result = controller.getHealth();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.service).toBe('gateway');
    expect(typeof result.uptimeSeconds).toBe('number');
  });

  it('returns readiness payload with checks and probe status code', async () => {
    const controller = new HealthController();
    const res = mockRes();
    const result = await controller.getReady(res as never);
    expect(result.checks?.process).toBe(HealthStatus.Ok);
    expect(result.checks?.auth).toBeDefined();
    expect([200, 503]).toContain(res.statusCode);
    if (result.status === HealthStatus.Ok) {
      expect(res.statusCode).toBe(200);
    } else {
      expect(res.statusCode).toBe(503);
    }
  });
});
