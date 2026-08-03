import { connectPrismaWithRetry } from './prisma.service';

describe('connectPrismaWithRetry', () => {
  it('succeeds on first connect', async () => {
    const client = { $connect: jest.fn().mockResolvedValue(undefined) };
    await connectPrismaWithRetry(client, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
    expect(client.$connect).toHaveBeenCalledTimes(1);
  });

  it('retries then succeeds', async () => {
    const client = {
      $connect: jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(undefined),
    };
    await connectPrismaWithRetry(client, { attempts: 4, baseDelayMs: 1, maxDelayMs: 2 });
    expect(client.$connect).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting attempts', async () => {
    const client = {
      $connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    await expect(
      connectPrismaWithRetry(client, { attempts: 3, baseDelayMs: 1, maxDelayMs: 2 }),
    ).rejects.toThrow('ECONNREFUSED');
    expect(client.$connect).toHaveBeenCalledTimes(3);
  });
});
