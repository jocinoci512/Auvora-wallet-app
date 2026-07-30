import { withGetRetry } from './get-retry';

describe('withGetRetry', () => {
  it('caps attempts', async () => {
    let calls = 0;
    await expect(
      withGetRetry(
        async () => {
          calls += 1;
          throw new Error('boom');
        },
        { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0 },
      ),
    ).rejects.toThrow('boom');
    expect(calls).toBe(3);
  });

  it('returns after transient failure', async () => {
    let calls = 0;
    const value = await withGetRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw new Error('transient');
        return 7;
      },
      { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0 },
    );
    expect(value).toBe(7);
    expect(calls).toBe(2);
  });
});
