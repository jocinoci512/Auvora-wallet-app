import { resolveActivationRoute } from './activation-route';

describe('resolveActivationRoute', () => {
  it('routes to unlock when remote vault exists and local session is empty', () => {
    expect(resolveActivationRoute({ hasRemoteVault: true, hasLocalSessionVault: false })).toBe(
      'unlock',
    );
  });

  it('routes to ready when remote and local session both present', () => {
    expect(resolveActivationRoute({ hasRemoteVault: true, hasLocalSessionVault: true })).toBe(
      'ready',
    );
  });

  it('routes to missing (not recover) when vault is absent', () => {
    expect(resolveActivationRoute({ hasRemoteVault: false, hasLocalSessionVault: false })).toBe(
      'missing',
    );
  });

  it('only enters recover after explicit selection', () => {
    expect(
      resolveActivationRoute({
        hasRemoteVault: false,
        hasLocalSessionVault: false,
        recoverExplicit: true,
      }),
    ).toBe('recover');
  });
});
