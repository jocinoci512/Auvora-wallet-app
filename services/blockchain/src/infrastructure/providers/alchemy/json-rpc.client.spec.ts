import { JsonRpcClient, JsonRpcError } from './json-rpc.client';

describe('JsonRpcClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns RPC result on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: '0x10' }),
    }) as unknown as typeof fetch;

    const client = new JsonRpcClient('https://example.com/v2/secret', {
      label: 'test-rpc',
      maxRetries: 0,
    });
    await expect(client.call<string>('eth_blockNumber')).resolves.toBe('0x10');
    expect(client.getMetrics().requests).toBe(1);
    expect(client.getMetrics().errors).toBe(0);
    expect(client.getSafeEndpoint()).toBe('test-rpc');
  });

  it('retries transient failures then succeeds', async () => {
    let calls = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        return { ok: false, status: 503, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ result: 42 }) };
    }) as unknown as typeof fetch;

    const client = new JsonRpcClient('https://example.com/v2/secret', {
      label: 'retry-rpc',
      maxRetries: 2,
    });
    await expect(client.call<number>('getblockcount')).resolves.toBe(42);
    expect(client.getMetrics().retries).toBe(1);
    expect(client.getMetrics().errors).toBe(1);
  });

  it('surfaces JSON-RPC errors without leaking secrets', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: { code: -32000, message: 'rate limited' } }),
    }) as unknown as typeof fetch;

    const client = new JsonRpcClient('https://example.com/v2/super-secret-key', {
      maxRetries: 0,
    });
    await expect(client.call('eth_gasPrice')).rejects.toBeInstanceOf(JsonRpcError);
    expect(client.getSafeEndpoint()).not.toContain('super-secret-key');
  });

  it('times out when fetch hangs', async () => {
    global.fetch = jest.fn().mockImplementation((_url, init: { signal?: AbortSignal }) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        });
      });
    }) as unknown as typeof fetch;

    const client = new JsonRpcClient('https://example.com/v2/secret', {
      label: 'timeout-rpc',
      timeoutMs: 40,
      maxRetries: 0,
    });
    await expect(client.call('eth_blockNumber')).rejects.toThrow(/timeout/i);
  });
});
