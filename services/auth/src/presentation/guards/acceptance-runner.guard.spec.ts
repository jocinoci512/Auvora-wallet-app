import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { AcceptanceRunnerGuard } from './acceptance-runner.guard';

function context(header?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) => (name === 'x-acceptance-runner-key' ? header : undefined),
      }),
    }),
  } as ExecutionContext;
}

describe('AcceptanceRunnerGuard', () => {
  const redisGet = jest.fn();
  const guard = new AcceptanceRunnerGuard({
    getClient: () => ({ get: redisGet }),
  } as never);

  beforeEach(() => jest.clearAllMocks());

  it('rejects when Redis runner key is missing (inactive)', async () => {
    redisGet.mockResolvedValue(null);
    await expect(guard.canActivate(context('runner-secret-key-123456'))).rejects.toThrow(
      new UnauthorizedException('Acceptance runner inactive'),
    );
  });

  it('accepts a matching runner key when enabled', async () => {
    redisGet.mockResolvedValue('runner-secret-key-123456');
    await expect(guard.canActivate(context('runner-secret-key-123456'))).resolves.toBe(true);
  });

  it('rejects a mismatched runner key', async () => {
    redisGet.mockResolvedValue('runner-secret-key-123456');
    await expect(guard.canActivate(context('wrong-key'))).rejects.toThrow(
      new UnauthorizedException('Invalid acceptance runner key'),
    );
  });

  it('rejects when header is missing', async () => {
    redisGet.mockResolvedValue('runner-secret-key-123456');
    await expect(guard.canActivate(context(undefined))).rejects.toThrow(
      new UnauthorizedException('Invalid acceptance runner key'),
    );
  });
});
