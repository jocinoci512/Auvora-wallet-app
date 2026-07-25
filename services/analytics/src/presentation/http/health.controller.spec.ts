import { HealthStatus } from '@auvora/types';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok liveness payload', () => {
    const controller = new HealthController();
    const result = controller.getHealth();
    expect(result.status).toBe(HealthStatus.Ok);
    expect(result.service).toBe('analytics');
    expect(typeof result.uptimeSeconds).toBe('number');
  });
});
