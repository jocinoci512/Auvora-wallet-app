import { EventEmitter } from 'node:events';
import { ADMIN_EVENTS_CHANNEL, serializeAdminEvent, sanitizeAdminEvent } from '../../domain';
import { RealtimeHubService, type RealtimeSink } from './realtime-hub.service';
import type { ServiceEnv } from '../../config/env.schema';
import type { RedisPort } from '../../infrastructure/redis/redis.port';

class FakeSubscriber extends EventEmitter {
  subscribed: string[] = [];
  quit = jest.fn().mockResolvedValue('OK');
  disconnect = jest.fn();
  subscribe = jest.fn(async (channel: string) => {
    this.subscribed.push(channel);
    return 1;
  });
}

class FakeSink implements RealtimeSink {
  chunks: string[] = [];
  ended = false;
  private drainCb?: () => void;
  constructor(private writer: (chunk: string) => boolean = () => true) {}
  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return this.writer(chunk);
  }
  end(): void {
    this.ended = true;
  }
  onDrain(cb: () => void): void {
    this.drainCb = cb;
  }
  triggerDrain(): void {
    this.drainCb?.();
  }
  all(): string {
    return this.chunks.join('');
  }
}

function makeEnv(overrides: Partial<ServiceEnv> = {}): ServiceEnv {
  return {
    ADMIN_REALTIME_ENABLED: true,
    ADMIN_REALTIME_MAX_PER_ADMIN: 3,
    ADMIN_REALTIME_MAX_GLOBAL: 5,
    ADMIN_REALTIME_HEARTBEAT_MS: 10_000,
    ADMIN_REALTIME_CLIENT_BUFFER: 4,
    ...overrides,
  } as unknown as ServiceEnv;
}

function makeHub(env: ServiceEnv): { hub: RealtimeHubService; sub: FakeSubscriber } {
  const sub = new FakeSubscriber();
  const redis: RedisPort = {
    ping: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(),
    createSubscriber: jest.fn(() => sub as unknown as never),
  };
  const hub = new RealtimeHubService(env, redis);
  return { hub, sub };
}

describe('RealtimeHubService', () => {
  it('subscribes exactly once to the canonical channel on init', () => {
    const { hub, sub } = makeHub(makeEnv());
    hub.onModuleInit();
    hub.onModuleInit(); // duplicate init must be a no-op
    expect(sub.subscribe).toHaveBeenCalledTimes(1);
    expect(sub.subscribed).toEqual([ADMIN_EVENTS_CHANNEL]);
    expect(sub.listenerCount('message')).toBe(1);
  });

  it('delivers a published event to a registered connection', () => {
    const { hub } = makeHub(makeEnv());
    hub.onModuleInit();
    const sink = new FakeSink();
    const res = hub.register('admin-1', sink);
    expect(res.ok).toBe(true);

    const event = sanitizeAdminEvent({ type: 'USER_CREATED', userId: 'u1' })!;
    hub.handleMessage(ADMIN_EVENTS_CHANNEL, serializeAdminEvent(event));

    const out = sink.all();
    expect(out).toContain('event: USER_CREATED');
    expect(out).toContain('"userId":"u1"');
    expect(out).toContain(`id: ${event.id}`);
  });

  it('re-sanitises inbound messages (defence in depth) and drops junk', () => {
    const { hub } = makeHub(makeEnv());
    hub.onModuleInit();
    const sink = new FakeSink();
    hub.register('admin-1', sink);
    const before = sink.chunks.length;

    hub.handleMessage(ADMIN_EVENTS_CHANNEL, 'not-json');
    hub.handleMessage(ADMIN_EVENTS_CHANNEL, JSON.stringify({ type: 'UNKNOWN' }));
    hub.handleMessage('some:other:channel', JSON.stringify({ type: 'USER_CREATED' }));
    // A payload sneaking a secret still gets scrubbed before delivery.
    hub.handleMessage(
      ADMIN_EVENTS_CHANNEL,
      JSON.stringify({ type: 'SECURITY_EVENT', metadata: { refreshToken: 'LEAK' } }),
    );

    expect(sink.all()).not.toContain('LEAK');
    // Only the one valid (scrubbed) event added frames.
    expect(sink.chunks.length).toBeGreaterThan(before);
  });

  it('enforces per-admin connection limit', () => {
    const { hub } = makeHub(makeEnv({ ADMIN_REALTIME_MAX_PER_ADMIN: 2 } as Partial<ServiceEnv>));
    hub.onModuleInit();
    expect(hub.register('admin-1', new FakeSink()).ok).toBe(true);
    expect(hub.register('admin-1', new FakeSink()).ok).toBe(true);
    const third = hub.register('admin-1', new FakeSink());
    expect(third.ok).toBe(false);
    expect(third.reason).toBe('per_admin_limit');
    // A different admin is unaffected.
    expect(hub.register('admin-2', new FakeSink()).ok).toBe(true);
  });

  it('enforces global connection limit', () => {
    const { hub } = makeHub(makeEnv({ ADMIN_REALTIME_MAX_GLOBAL: 2 } as Partial<ServiceEnv>));
    hub.onModuleInit();
    expect(hub.register('a', new FakeSink()).ok).toBe(true);
    expect(hub.register('b', new FakeSink()).ok).toBe(true);
    const third = hub.register('c', new FakeSink());
    expect(third.ok).toBe(false);
    expect(third.reason).toBe('global_limit');
  });

  it('cleans up connections on remove and frees per-admin slots', () => {
    const { hub } = makeHub(makeEnv({ ADMIN_REALTIME_MAX_PER_ADMIN: 1 } as Partial<ServiceEnv>));
    hub.onModuleInit();
    const first = hub.register('admin-1', new FakeSink());
    expect(hub.register('admin-1', new FakeSink()).ok).toBe(false);
    hub.remove(first.connectionId!);
    expect(hub.connectionCount()).toBe(0);
    // Slot freed.
    expect(hub.register('admin-1', new FakeSink()).ok).toBe(true);
    hub.remove('does-not-exist'); // idempotent
  });

  it('drops slow clients that overflow the bounded buffer instead of growing memory', () => {
    const { hub } = makeHub(makeEnv({ ADMIN_REALTIME_CLIENT_BUFFER: 2 } as Partial<ServiceEnv>));
    hub.onModuleInit();
    // Sink that never accepts writes → everything queues.
    const sink = new FakeSink(() => false);
    hub.register('admin-1', sink);
    expect(hub.connectionCount()).toBe(1);

    // Push more events than the buffer can hold.
    for (let i = 0; i < 10; i += 1) {
      hub.handleMessage(
        ADMIN_EVENTS_CHANNEL,
        JSON.stringify({ type: 'USER_LOGIN', userId: `u${i}` }),
      );
    }
    expect(hub.connectionCount()).toBe(0);
    expect(sink.ended).toBe(true);
  });

  it('flushes buffered frames after a drain when the client was backpressured', () => {
    const { hub } = makeHub(makeEnv());
    let accept = false;
    const sink = new FakeSink(() => accept);
    hub.onModuleInit();
    hub.register('admin-1', sink);
    hub.handleMessage(
      ADMIN_EVENTS_CHANNEL,
      JSON.stringify({ type: 'USER_LOGIN', userId: 'later' }),
    );
    accept = true;
    sink.triggerDrain();
    expect(sink.all()).toContain('"userId":"later"');
  });

  it('does not accumulate listeners or emit MaxListenersExceededWarning under many connections', () => {
    const warnings: string[] = [];
    const onWarn = (w: Error): void => {
      warnings.push(w.name);
    };
    process.on('warning', onWarn);
    try {
      const { hub, sub } = makeHub(
        makeEnv({ ADMIN_REALTIME_MAX_GLOBAL: 100 } as Partial<ServiceEnv>),
      );
      hub.onModuleInit();
      for (let i = 0; i < 40; i += 1) {
        hub.register(`admin-${i}`, new FakeSink());
      }
      hub.handleMessage(ADMIN_EVENTS_CHANNEL, JSON.stringify({ type: 'USER_CREATED' }));
      // The subscriber still has exactly ONE message listener regardless of clients.
      expect(sub.listenerCount('message')).toBe(1);
    } finally {
      process.removeListener('warning', onWarn);
    }
    expect(warnings).not.toContain('MaxListenersExceededWarning');
  });

  it('does not crash when the subscriber is unavailable (Redis outage on init)', () => {
    const redis: RedisPort = {
      ping: jest.fn().mockResolvedValue(false),
      getClient: jest.fn(),
      createSubscriber: jest.fn(() => {
        throw new Error('ECONNREFUSED');
      }),
    };
    const hub = new RealtimeHubService(makeEnv(), redis);
    expect(() => hub.onModuleInit()).not.toThrow();
    // API endpoints (register) still work; stream simply has no upstream events.
    expect(hub.register('admin-1', new FakeSink()).ok).toBe(true);
  });

  it('does not crash when a subscriber error fires', () => {
    const { hub, sub } = makeHub(makeEnv());
    hub.onModuleInit();
    expect(() => sub.emit('error', new Error('connection reset'))).not.toThrow();
    expect(() => sub.emit('end')).not.toThrow();
  });

  it('gracefully shuts down: clears timer, closes clients, quits subscriber', async () => {
    const { hub, sub } = makeHub(makeEnv());
    hub.onModuleInit();
    const sink = new FakeSink();
    hub.register('admin-1', sink);
    await hub.onModuleDestroy();
    expect(sink.ended).toBe(true);
    expect(hub.connectionCount()).toBe(0);
    expect(sub.quit).toHaveBeenCalledTimes(1);
  });

  it('falls back to disconnect if quit throws during shutdown', async () => {
    const { hub, sub } = makeHub(makeEnv());
    hub.onModuleInit();
    sub.quit.mockRejectedValueOnce(new Error('Connection is closed'));
    await expect(hub.onModuleDestroy()).resolves.toBeUndefined();
    expect(sub.disconnect).toHaveBeenCalledTimes(1);
  });

  it('honours ADMIN_REALTIME_ENABLED=false (no subscription, register rejected)', () => {
    const { hub, sub } = makeHub(makeEnv({ ADMIN_REALTIME_ENABLED: false } as Partial<ServiceEnv>));
    hub.onModuleInit();
    expect(sub.subscribe).not.toHaveBeenCalled();
    const res = hub.register('admin-1', new FakeSink());
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('disabled');
  });
});
