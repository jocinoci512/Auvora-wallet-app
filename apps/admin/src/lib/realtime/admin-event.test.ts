import { SseParser, affectsUserDirectory, nextBackoffMs, parseAdminEvent } from './admin-event';

describe('SseParser', () => {
  it('parses a single complete frame', () => {
    const p = new SseParser();
    const frames = p.push('id: 1\nevent: USER_CREATED\ndata: {"ok":true}\n\n');
    expect(frames).toEqual([{ id: '1', event: 'USER_CREATED', data: '{"ok":true}' }]);
  });

  it('buffers partial frames across chunks', () => {
    const p = new SseParser();
    expect(p.push('id: 1\nev')).toEqual([]);
    expect(p.push('ent: USER_LOGIN\ndata: {"a":1}\n\n')).toEqual([
      { id: '1', event: 'USER_LOGIN', data: '{"a":1}' },
    ]);
  });

  it('ignores comment/heartbeat lines', () => {
    const p = new SseParser();
    const frames = p.push(': heartbeat 123\n\nid: 2\nevent: USER_LOGOUT\ndata: {}\n\n');
    expect(frames).toEqual([{ id: '2', event: 'USER_LOGOUT', data: '{}' }]);
  });

  it('handles CRLF frame separators', () => {
    const p = new SseParser();
    const frames = p.push('id: 9\r\nevent: SECURITY_EVENT\r\ndata: {"x":1}\r\n\r\n');
    expect(frames[0]).toMatchObject({ id: '9', event: 'SECURITY_EVENT', data: '{"x":1}' });
  });

  it('handles multiple frames in one chunk', () => {
    const p = new SseParser();
    const frames = p.push('data: {"n":1}\n\ndata: {"n":2}\n\n');
    expect(frames).toHaveLength(2);
  });
});

describe('parseAdminEvent', () => {
  it('parses a valid event', () => {
    const event = parseAdminEvent({
      data: JSON.stringify({
        id: 'e1',
        type: 'USER_LOGIN',
        timestamp: new Date().toISOString(),
        service: 'auth',
        severity: 'info',
        platform: 'android',
      }),
    });
    expect(event?.type).toBe('USER_LOGIN');
    expect(event?.platform).toBe('android');
  });

  it('rejects unknown types, junk json, and missing fields', () => {
    expect(parseAdminEvent({ data: 'not json' })).toBeNull();
    expect(
      parseAdminEvent({ data: JSON.stringify({ type: 'NOPE', id: 'x', timestamp: 't' }) }),
    ).toBeNull();
    expect(parseAdminEvent({ data: JSON.stringify({ type: 'USER_LOGIN' }) })).toBeNull();
    expect(parseAdminEvent({})).toBeNull();
  });
});

describe('affectsUserDirectory', () => {
  it('flags account/session/security events', () => {
    expect(affectsUserDirectory('USER_CREATED')).toBe(true);
    expect(affectsUserDirectory('ACCOUNT_STATUS_CHANGED')).toBe(true);
    expect(affectsUserDirectory('SESSION_REVOKED')).toBe(true);
  });
  it('does not flag unrelated wallet/sign events', () => {
    expect(affectsUserDirectory('WALLET_ADDED')).toBe(false);
    expect(affectsUserDirectory('SIGN_REQUEST_CREATED')).toBe(false);
  });
});

describe('nextBackoffMs', () => {
  it('is bounded and monotonic in expectation', () => {
    const zero = nextBackoffMs(0, 1000, 30_000, () => 0);
    expect(zero).toBe(1000);
    const big = nextBackoffMs(20, 1000, 30_000, () => 1);
    expect(big).toBeLessThanOrEqual(30_000);
    const mid = nextBackoffMs(2, 1000, 30_000, () => 0.5);
    expect(mid).toBeGreaterThanOrEqual(1000);
    expect(mid).toBeLessThanOrEqual(30_000);
  });
});
