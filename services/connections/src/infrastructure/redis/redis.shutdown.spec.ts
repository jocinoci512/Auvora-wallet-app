import { RedisAdapter } from './redis.adapter';

/**
 * Graceful shutdown must never reject: main.ts runs `void shutdown()`, so a
 * rejected quit() would become an unhandled rejection and crash the process with
 * a non-zero exit code during SIGTERM.
 */
describe('RedisAdapter.onModuleDestroy graceful shutdown', () => {
  let adapter: RedisAdapter;

  beforeEach(() => {
    // lazyConnect keeps this offline — no socket is opened during the test.
    adapter = new RedisAdapter({ REDIS_URL: 'redis://127.0.0.1:6379' } as never);
  });

  afterEach(() => {
    try {
      adapter.getClient().disconnect();
    } catch {
      /* ignore */
    }
  });

  it('quits cleanly when the client closes normally', async () => {
    const client = adapter.getClient();
    const quit = jest.spyOn(client, 'quit').mockResolvedValue('OK');
    const disconnect = jest.spyOn(client, 'disconnect').mockImplementation(() => undefined);
    await expect(adapter.onModuleDestroy()).resolves.toBeUndefined();
    expect(quit).toHaveBeenCalledTimes(1);
    expect(disconnect).not.toHaveBeenCalled();
  });

  it('falls back to disconnect and never throws when quit() rejects mid-shutdown', async () => {
    const client = adapter.getClient();
    jest.spyOn(client, 'quit').mockRejectedValue(new Error('Connection is closed'));
    const disconnect = jest.spyOn(client, 'disconnect').mockImplementation(() => undefined);
    await expect(adapter.onModuleDestroy()).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
