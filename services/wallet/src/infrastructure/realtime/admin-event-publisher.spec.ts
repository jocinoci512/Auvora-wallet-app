import { ADMIN_EVENTS_CHANNEL, RedisAdminEventPublisher } from './admin-event-publisher.adapter';
import type { RedisPort } from '../redis/redis.port';

function makePublisher(publish = jest.fn().mockResolvedValue(1)) {
  const redis: RedisPort = {
    ping: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(() => ({ publish }) as unknown as never),
  };
  return { publisher: new RedisAdminEventPublisher(redis), publish };
}

describe('wallet RedisAdminEventPublisher', () => {
  it('publishes a WALLET_ADDED envelope to the canonical channel', async () => {
    const { publisher, publish } = makePublisher();
    await publisher.publish({
      type: 'WALLET_ADDED',
      userId: 'u1',
      targetId: 'w1',
      metadata: { assetCode: 'ETH', status: 'ACTIVE' },
    });
    const [channel, msg] = publish.mock.calls[0] as [string, string];
    expect(channel).toBe(ADMIN_EVENTS_CHANNEL);
    const parsed = JSON.parse(msg);
    expect(parsed).toMatchObject({
      type: 'WALLET_ADDED',
      service: 'wallet',
      userId: 'u1',
      targetId: 'w1',
      metadata: { assetCode: 'ETH', status: 'ACTIVE' },
    });
    expect(parsed.id).toMatch(/^evt_/);
  });

  it('never writes secret-bearing metadata to Redis', async () => {
    const { publisher, publish } = makePublisher();
    await publisher.publish({
      type: 'WALLET_ADDED',
      userId: 'u1',
      metadata: {
        privateKey: 'LEAK1',
        mnemonic: 'LEAK2',
        seedPhrase: 'LEAK3',
        vaultCiphertext: 'LEAK4',
        signature: 'LEAK5',
        assetCode: 'BTC',
      } as never,
    });
    const msg = (publish.mock.calls[0] as [string, string])[1];
    for (const leak of ['LEAK1', 'LEAK2', 'LEAK3', 'LEAK4', 'LEAK5']) {
      expect(msg).not.toContain(leak);
    }
    expect(msg).toContain('BTC');
  });

  it('swallows Redis errors (fire-and-forget)', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('redis down'));
    const { publisher } = makePublisher(publish);
    await expect(publisher.publish({ type: 'WALLET_REMOVED' })).resolves.toBeUndefined();
  });
});
