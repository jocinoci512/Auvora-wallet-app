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

  it('binds default fetch so method-style calls keep Window/globalThis receiver', async () => {
    const original = globalThis.fetch;
    const calls: unknown[][] = [];
    globalThis.fetch = function boundProbe(this: unknown, ...args: Parameters<typeof fetch>) {
      // Browser throws Illegal invocation when `this` is not the global object.
      expect(this).toBe(globalThis);
      calls.push(args);
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: { items: [], total: 0 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    } as typeof fetch;

    try {
      const client = new AuvoraClient({ baseUrl: 'http://localhost:4000' });
      await client.listWallets();
      expect(calls).toHaveLength(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
