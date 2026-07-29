import { ConflictError } from '../../domain';
import {
  signWebhookPayload,
  WEBHOOK_SIGNATURE_HEADER,
} from '../../infrastructure/crypto/webhook-signer';
import { WebhookService } from './webhook.service';

function buildCryptoMock() {
  const store = new Map<string, string>();
  return {
    encrypt: jest.fn((plaintext: string) => {
      const token = `enc:${plaintext}`;
      store.set(token, plaintext);
      return token;
    }),
    decrypt: jest.fn(
      (ciphertext: string) => store.get(ciphertext) ?? ciphertext.replace('enc:', ''),
    ),
    hash: jest.fn((value: string) => value),
  };
}

function buildPrismaMock() {
  const endpoint = {
    id: 'endpoint-1',
    ownerUserId: 'user-1',
    url: 'https://example.com/webhook',
    secretEncrypted: 'enc:top-secret',
    isEnabled: true,
    eventFilters: [] as string[],
    version: 'v1',
  };
  const deliveries = new Map<string, Record<string, unknown>>();
  let deliveryCounter = 0;

  return {
    endpoint,
    deliveries,
    webhookEndpoint: {
      create: jest.fn().mockResolvedValue(endpoint),
      findUnique: jest.fn().mockResolvedValue(endpoint),
      findMany: jest.fn().mockResolvedValue([endpoint]),
    },
    webhookDelivery: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        deliveryCounter += 1;
        const id = `delivery-${deliveryCounter}`;
        const record = { id, attemptCount: 0, ...data };
        deliveries.set(id, record);
        return Promise.resolve(record);
      }),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        const record = deliveries.get(where.id);
        if (!record) return Promise.resolve(null);
        return Promise.resolve({ ...record, endpoint });
      }),
      findMany: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            Array.from(deliveries.values()).filter((record) => record['status'] === 'RETRYING'),
          ),
        ),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const existing = deliveries.get(where.id) ?? {};
            const increment = (data['attemptCount'] as { increment?: number } | undefined)
              ?.increment;
            const merged = {
              ...existing,
              ...data,
              attemptCount:
                increment !== undefined
                  ? ((existing['attemptCount'] as number) ?? 0) + increment
                  : existing['attemptCount'],
            };
            deliveries.set(where.id, merged);
            return Promise.resolve(merged);
          },
        ),
      updateMany: jest
        .fn()
        .mockImplementation(
          ({
            where,
            data,
          }: {
            where: { id: string; status: string };
            data: Record<string, unknown>;
          }) => {
            const existing = deliveries.get(where.id);
            if (!existing || existing['status'] !== where.status) {
              return Promise.resolve({ count: 0 });
            }
            deliveries.set(where.id, { ...existing, ...data });
            return Promise.resolve({ count: 1 });
          },
        ),
    },
  };
}

describe('WebhookService', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('registers an endpoint by encrypting the generated secret', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    const service = new WebhookService(prisma as never, crypto as never);

    const result = await service.register({
      ownerUserId: 'user-1',
      name: 'My hook',
      url: 'https://example.com/webhook',
    });

    expect(crypto.encrypt).toHaveBeenCalled();
    expect(result.secret).toBeDefined();
    expect(prisma.webhookEndpoint.create).toHaveBeenCalled();
  });

  it('signs the outgoing payload with an HMAC-SHA256 signature header', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    const capturedHeaders: Record<string, string>[] = [];
    globalThis.fetch = jest
      .fn()
      .mockImplementation((_url: string, init: { headers: Record<string, string> }) => {
        capturedHeaders.push(init.headers);
        return Promise.resolve({ status: 200, text: async () => 'ok' });
      }) as unknown as typeof fetch;

    const service = new WebhookService(prisma as never, crypto as never);
    await service.deliver('endpoint-1', 'notification.sent', { hello: 'world' });

    expect(capturedHeaders).toHaveLength(1);
    const signature = capturedHeaders[0][WEBHOOK_SIGNATURE_HEADER];
    expect(signature).toMatch(/^v1=/);
  });

  it('wraps the payload in a versioned envelope before signing/sending', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    const capturedBodies: string[] = [];
    globalThis.fetch = jest.fn().mockImplementation((_url: string, init: { body: string }) => {
      capturedBodies.push(init.body);
      return Promise.resolve({ status: 200, text: async () => 'ok' });
    }) as unknown as typeof fetch;

    const service = new WebhookService(prisma as never, crypto as never);
    await service.deliver('endpoint-1', 'notification.sent', { hello: 'world' });

    expect(capturedBodies).toHaveLength(1);
    const envelope = JSON.parse(capturedBodies[0]) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      apiVersion: 'v1',
      eventType: 'notification.sent',
      data: { hello: 'world' },
    });
    expect(typeof envelope['deliveredAt']).toBe('string');
  });

  it('marks a delivery SUCCESS on a 2xx response', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ status: 202, text: async () => 'accepted' }) as unknown as typeof fetch;

    const service = new WebhookService(prisma as never, crypto as never);
    const result = await service.deliver('endpoint-1', 'notification.sent', { hello: 'world' });

    expect(result).toMatchObject({ status: 'SUCCESS', responseCode: 202 });
  });

  it('marks a delivery RETRYING with a future nextAttemptAt on a non-2xx response', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    globalThis.fetch = jest.fn().mockResolvedValue({
      status: 500,
      text: async () => 'server error',
    }) as unknown as typeof fetch;

    const service = new WebhookService(prisma as never, crypto as never);
    const result = await service.deliver('endpoint-1', 'notification.sent', { hello: 'world' });

    expect(result).toMatchObject({ status: 'RETRYING', responseCode: 500 });
    expect((result as { nextAttemptAt?: Date }).nextAttemptAt).toBeInstanceOf(Date);
  });

  it('refuses to retry a delivery that already succeeded', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    prisma.webhookDelivery.findUnique.mockResolvedValueOnce({
      id: 'delivery-1',
      status: 'SUCCESS',
      attemptCount: 1,
      endpoint: prisma.endpoint,
    });
    const service = new WebhookService(prisma as never, crypto as never);

    await expect(service.retry('delivery-1')).rejects.toThrow(ConflictError);
  });

  it('processNextRetry claims and dispatches a single due RETRYING delivery', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    prisma.deliveries.set('delivery-1', {
      id: 'delivery-1',
      endpointId: 'endpoint-1',
      eventType: 'notification.sent',
      payload: { hello: 'world' },
      status: 'RETRYING',
      attemptCount: 1,
      nextAttemptAt: new Date(Date.now() - 1000),
    });
    globalThis.fetch = jest
      .fn()
      .mockResolvedValue({ status: 200, text: async () => 'ok' }) as unknown as typeof fetch;

    const service = new WebhookService(prisma as never, crypto as never);
    const result = await service.processNextRetry('worker-1');

    expect(result).toEqual({ processed: true, deliveryId: 'delivery-1' });
    expect(prisma.deliveries.get('delivery-1')).toMatchObject({ status: 'SUCCESS' });
  });

  it('processNextRetry returns processed:false when nothing is due', async () => {
    const prisma = buildPrismaMock();
    const crypto = buildCryptoMock();
    const service = new WebhookService(prisma as never, crypto as never);

    const result = await service.processNextRetry();
    expect(result).toEqual({ processed: false });
  });

  it('produces a verifiable signature that changes with the payload', () => {
    const secret = 'shhh';
    const timestamp = 1_700_000_000_000;
    const signatureA = signWebhookPayload(secret, JSON.stringify({ a: 1 }), timestamp);
    const signatureB = signWebhookPayload(secret, JSON.stringify({ a: 2 }), timestamp);
    expect(signatureA).not.toEqual(signatureB);
    expect(signatureA).toEqual(signWebhookPayload(secret, JSON.stringify({ a: 1 }), timestamp));
  });
});
