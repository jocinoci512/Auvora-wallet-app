import { ADMIN_EVENTS_CHANNEL, RedisAdminEventPublisher } from './admin-event-publisher.adapter';
import type { RedisPort } from '../redis/redis.port';

function makePublisher(publish = jest.fn().mockResolvedValue(1)) {
  const redis = {
    ping: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(() => ({ publish }) as unknown as never),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  } as unknown as RedisPort;
  return { publisher: new RedisAdminEventPublisher(redis), publish };
}

describe('connections RedisAdminEventPublisher', () => {
  it('publishes CONNECTION_CREATED to the canonical channel with safe metadata', async () => {
    const { publisher, publish } = makePublisher();
    await publisher.publish({
      type: 'CONNECTION_CREATED',
      userId: 'u1',
      targetId: 'sess-1',
      metadata: { kind: 'WALLETCONNECT', status: 'CONNECTED', provider: 'walletconnect' },
    });
    const [channel, msg] = publish.mock.calls[0] as [string, string];
    expect(channel).toBe(ADMIN_EVENTS_CHANNEL);
    const parsed = JSON.parse(msg);
    expect(parsed).toMatchObject({
      type: 'CONNECTION_CREATED',
      service: 'connections',
      userId: 'u1',
      targetId: 'sess-1',
      metadata: { kind: 'WALLETCONNECT', status: 'CONNECTED' },
    });
  });

  it('never emits WalletConnect symKey / URI / signature / payload material', async () => {
    const { publisher, publish } = makePublisher();
    await publisher.publish({
      type: 'SIGN_REQUEST_COMPLETED',
      userId: 'u1',
      targetId: 'req-1',
      metadata: {
        symKey: 'LEAK_SYMKEY',
        uri: 'wc:LEAK_URI@2?symKey=abc',
        signature: 'LEAK_SIG',
        payload: 'LEAK_PAYLOAD',
        preview: 'LEAK_PREVIEW',
        network: 'ETHEREUM',
        txHash: '0xpublichash',
      } as never,
    });
    const msg = (publish.mock.calls[0] as [string, string])[1];
    for (const leak of ['LEAK_SYMKEY', 'LEAK_URI', 'LEAK_SIG', 'LEAK_PAYLOAD', 'LEAK_PREVIEW']) {
      expect(msg).not.toContain(leak);
    }
    // Public, safe fields are retained.
    expect(msg).toContain('ETHEREUM');
    expect(msg).toContain('0xpublichash');
  });

  it('swallows Redis errors (fire-and-forget)', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('redis down'));
    const { publisher } = makePublisher(publish);
    await expect(
      publisher.publish({ type: 'SIGN_REQUEST_FAILED', userId: 'u1' }),
    ).resolves.toBeUndefined();
  });
});
