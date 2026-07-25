import { HealthStatus } from '@auvora/types';
import { AuvoraClient } from './client';

describe('AuvoraClient', () => {
  it('returns parsed health payloads', async () => {
    const payload = {
      status: HealthStatus.Ok,
      service: 'gateway',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 12,
    };

    const client = new AuvoraClient({
      baseUrl: 'http://localhost:3000',
      fetchImpl: async () =>
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    });

    await expect(client.getHealth()).resolves.toEqual(payload);
  });
});
