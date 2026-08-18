import { createAdminLiveSessionMiddleware } from './admin-live-session.middleware';

describe('admin live-session middleware', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function run(method: string, url: string) {
    const middleware = createAdminLiveSessionMiddleware('http://auth.local:4001');
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();
    return { middleware, res, next, method, url };
  }

  it('skips non-admin paths and auth-owned admin routes', () => {
    const { middleware, next } = run('POST', '/api/v1/wallets');
    middleware({ method: 'POST', originalUrl: '/api/v1/wallets' } as never, {} as never, next);
    expect(next).toHaveBeenCalled();

    const second = run('POST', '/api/v1/admin/operators/1/status');
    second.middleware(
      { method: 'POST', originalUrl: '/api/v1/admin/operators/1/status' } as never,
      second.res as never,
      second.next,
    );
    expect(second.next).toHaveBeenCalled();
  });

  it('allows GET wallet admin reads without an extra session round-trip', () => {
    const { middleware, next } = run('GET', '/api/v1/admin/wallets');
    globalThis.fetch = jest.fn() as never;
    middleware(
      { method: 'GET', originalUrl: '/api/v1/admin/wallets', headers: {} } as never,
      {} as never,
      next,
    );
    expect(next).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rejects non-auth Admin mutations when the live session is revoked', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as never;
    const { middleware, res, next } = run('POST', '/api/v1/admin/wallets/w1/suspend');
    middleware(
      {
        method: 'POST',
        originalUrl: '/api/v1/admin/wallets/w1/suspend',
        headers: { cookie: 'admin_access_token=dead' },
      } as never,
      res as never,
      next,
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows non-auth Admin mutations when the live session is valid', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as never;
    const { middleware, next } = run('POST', '/api/v1/admin/connections/x');
    middleware(
      {
        method: 'POST',
        originalUrl: '/api/v1/admin/connections/x',
        headers: { cookie: 'admin_access_token=live' },
      } as never,
      {} as never,
      next,
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenCalled();
  });
});
