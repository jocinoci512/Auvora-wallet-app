import type { Request, Response } from 'express';
import type { JwtAccessClaims } from '@auvora/types';
import { RealtimeController } from './realtime.controller';
import type { RealtimeHubService } from './realtime-hub.service';

function makeRes(): Response & { _headers: Record<string, unknown>; _status?: number } {
  const res = {
    _headers: {} as Record<string, unknown>,
    writeHead: jest.fn(function (this: unknown, status: number, headers: Record<string, unknown>) {
      (res as { _status?: number })._status = status;
      Object.assign(res._headers, headers);
      return res;
    }),
    flushHeaders: jest.fn(),
    write: jest.fn().mockReturnValue(true),
    end: jest.fn(),
    on: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response & { _headers: Record<string, unknown>; _status?: number };
  return res;
}

function makeReq(sub?: string): Request & { user: JwtAccessClaims } {
  return {
    user: { sub } as JwtAccessClaims,
    on: jest.fn(),
  } as unknown as Request & { user: JwtAccessClaims };
}

describe('RealtimeController', () => {
  it('sets SSE headers and wires cleanup on successful register', () => {
    const hub = {
      register: jest.fn().mockReturnValue({ ok: true, connectionId: 'conn-1' }),
      remove: jest.fn(),
      getStats: jest.fn(),
    } as unknown as RealtimeHubService;
    const controller = new RealtimeController(hub);
    const req = makeReq('admin-1');
    const res = makeRes();

    controller.streamEvents(req, res);

    expect(res._status).toBe(200);
    expect(res._headers['Content-Type']).toContain('text/event-stream');
    expect(res._headers['X-Accel-Buffering']).toBe('no');
    expect(hub.register).toHaveBeenCalledWith('admin-1', expect.anything());
    // close/error handlers registered for cleanup.
    expect((req.on as jest.Mock).mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['close', 'error']),
    );
  });

  it('rejects (and ends) when the hub declines the connection (limit reached)', () => {
    const hub = {
      register: jest.fn().mockReturnValue({ ok: false, reason: 'per_admin_limit' }),
      remove: jest.fn(),
    } as unknown as RealtimeHubService;
    const controller = new RealtimeController(hub);
    const res = makeRes();

    controller.streamEvents(makeReq('admin-1'), res);

    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('per_admin_limit'));
    expect(res.end).toHaveBeenCalled();
  });

  it('401s when there is no authenticated subject', () => {
    const hub = { register: jest.fn() } as unknown as RealtimeHubService;
    const controller = new RealtimeController(hub);
    const res = makeRes();

    controller.streamEvents(makeReq(undefined), res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(hub.register).not.toHaveBeenCalled();
  });

  it('status returns hub stats in a success envelope', () => {
    const stats = { global: 2, admins: 1, maxPerAdmin: 5, maxGlobal: 500 };
    const hub = { getStats: jest.fn().mockReturnValue(stats) } as unknown as RealtimeHubService;
    const controller = new RealtimeController(hub);
    const result = controller.status();
    expect(result).toMatchObject({ success: true, data: stats });
  });
});
