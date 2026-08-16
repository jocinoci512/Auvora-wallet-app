import { REALTIME_PROXY_PREFIXES, isRealtimeProxyPath } from './realtime-proxy.middleware';
import { AUTH_PROXY_PREFIXES } from './auth-proxy.middleware';

describe('realtime proxy routing', () => {
  it('matches the admin realtime SSE path and subpaths', () => {
    expect(isRealtimeProxyPath('/api/v1/admin/realtime')).toBe(true);
    expect(isRealtimeProxyPath('/api/v1/admin/realtime/events')).toBe(true);
    expect(isRealtimeProxyPath('/api/v1/admin/realtime/status')).toBe(true);
  });

  it('does not match unrelated admin or public paths', () => {
    expect(isRealtimeProxyPath('/api/v1/admin/users')).toBe(false);
    expect(isRealtimeProxyPath('/api/v1/admin/realtimex')).toBe(false);
    expect(isRealtimeProxyPath('/api/v1/auth/login')).toBe(false);
    expect(isRealtimeProxyPath('/health')).toBe(false);
  });

  it('is disjoint from the unified auth proxy prefixes (no double-handling)', () => {
    for (const realtime of REALTIME_PROXY_PREFIXES) {
      expect(AUTH_PROXY_PREFIXES).not.toContain(realtime);
    }
  });
});
