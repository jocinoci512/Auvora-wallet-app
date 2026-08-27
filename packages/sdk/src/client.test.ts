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

  it('getEncryptedVault and upsertEncryptedVault call /api/v1/vault', async () => {
    const calls: Array<{ method?: string; url?: string }> = [];
    const client = new AuvoraClient({
      baseUrl: 'http://localhost:4000',
      fetchImpl: async (input, init) => {
        calls.push({ method: init?.method, url: String(input) });
        if (init?.method === 'PUT') {
          return new Response(
            JSON.stringify({
              success: true,
              data: {
                algorithmId: 'auvora-vault-v1',
                version: 1,
                epoch: 1,
                kdfSalt: 'c2FsdA==',
                kdfParams: {},
                recoveryKdfSalt: 'c2FsdDI=',
                recoveryKdfParams: {},
                wrappedVaultKey: 'd3JhcA==',
                wrappedVaultKeyRecovery: 'd3JhcDI=',
                ciphertext: 'Y2lwaGVy',
                aad: 'auvora-vault-v1|user|1',
                updatedAt: new Date().toISOString(),
              },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        return new Response(JSON.stringify({ success: true, data: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    await expect(client.getEncryptedVault()).resolves.toBeNull();
    await expect(
      client.upsertEncryptedVault({
        algorithmId: 'auvora-vault-v1',
        version: 1,
        epoch: 1,
        kdfSalt: 'c2FsdA==',
        kdfParams: {},
        recoveryKdfSalt: 'c2FsdDI=',
        recoveryKdfParams: {},
        wrappedVaultKey: 'd3JhcA==',
        wrappedVaultKeyRecovery: 'd3JhcDI=',
        ciphertext: 'Y2lwaGVy',
        aad: 'auvora-vault-v1|user|1',
      }),
    ).resolves.toMatchObject({ epoch: 1, algorithmId: 'auvora-vault-v1' });

    expect(calls[0]?.method ?? 'GET').toBe('GET');
    expect(calls[0]?.url).toContain('/api/v1/vault');
    expect(calls[1]?.method).toBe('PUT');
    expect(calls[1]?.url).toContain('/api/v1/vault');
  });
});
