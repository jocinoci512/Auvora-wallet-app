import { ADMIN_EVENTS_CHANNEL } from '../../domain';
import { RedisAdminEventPublisher } from './redis-admin-event-publisher.adapter';
import type { ServiceEnv } from '../../config/env.schema';
import type { RedisPort } from '../redis/redis.port';

function makePublisher(opts: { enabled?: boolean; publish?: jest.Mock }): {
  publisher: RedisAdminEventPublisher;
  publish: jest.Mock;
} {
  const publish = opts.publish ?? jest.fn().mockResolvedValue(1);
  const redis: RedisPort = {
    ping: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(() => ({ publish }) as unknown as never),
    createSubscriber: jest.fn(),
  };
  const env = { ADMIN_REALTIME_ENABLED: opts.enabled ?? true } as unknown as ServiceEnv;
  return { publisher: new RedisAdminEventPublisher(redis, env), publish };
}

describe('RedisAdminEventPublisher', () => {
  it('publishes a sanitised event to the canonical channel', async () => {
    const { publisher, publish } = makePublisher({});
    await publisher.publish({ type: 'USER_LOGIN', userId: 'u1', platform: 'ANDROID' });
    expect(publish).toHaveBeenCalledTimes(1);
    const [channel, message] = publish.mock.calls[0] as [string, string];
    expect(channel).toBe(ADMIN_EVENTS_CHANNEL);
    const parsed = JSON.parse(message);
    expect(parsed.type).toBe('USER_LOGIN');
    expect(parsed.platform).toBe('android');
  });

  it('never writes secrets to Redis', async () => {
    const { publisher, publish } = makePublisher({});
    await publisher.publish({
      type: 'SECURITY_EVENT',
      metadata: { refreshToken: 'LEAK', passwordHash: 'HASH', safe: 'ok' },
    });
    const message = (publish.mock.calls[0] as [string, string])[1];
    expect(message).not.toContain('LEAK');
    expect(message).not.toContain('HASH');
    expect(message).toContain('ok');
  });

  it('drops unknown event types without publishing', async () => {
    const { publisher, publish } = makePublisher({});
    await publisher.publish({ type: 'NOPE' as never });
    expect(publish).not.toHaveBeenCalled();
  });

  it('swallows Redis errors (fire-and-forget)', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('redis down'));
    const { publisher } = makePublisher({ publish });
    await expect(publisher.publish({ type: 'USER_CREATED' })).resolves.toBeUndefined();
  });

  it('does nothing when realtime is disabled', async () => {
    const { publisher, publish } = makePublisher({ enabled: false });
    await publisher.publish({ type: 'USER_CREATED' });
    expect(publish).not.toHaveBeenCalled();
  });
});
