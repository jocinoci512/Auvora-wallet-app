import { Controller, Get, Inject, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { successResponse } from '@auvora/nest-common';
import type { JwtAccessClaims } from '@auvora/types';
import { ROLE_ADMIN, ROLE_SUPER_ADMIN, PERMISSION_USERS_READ } from '../../domain/permission-codes';
import { Permissions, Roles } from '../decorators/auth.decorators';
import { RealtimeHubService, type RealtimeSink } from './realtime-hub.service';

/**
 * Admin-only Server-Sent Events endpoint. Protected by the global JWT guard plus
 * class-level RolesGuard and endpoint-level PermissionsGuard — there is no
 * anonymous access and no internal-API-key bypass path from the browser. The
 * Gateway proxies this route with buffering/timeout disabled so the stream stays
 * open.
 */
@ApiTags('admin-realtime')
@Controller('api/v1/admin/realtime')
@Roles(ROLE_ADMIN, ROLE_SUPER_ADMIN)
export class RealtimeController {
  constructor(@Inject(RealtimeHubService) private readonly hub: RealtimeHubService) {}

  @Get('events')
  @Permissions(PERMISSION_USERS_READ)
  streamEvents(@Req() req: Request & { user: JwtAccessClaims }, @Res() res: Response): void {
    const adminUserId = req.user?.sub;
    if (!adminUserId) {
      res.status(401).json({ success: false, error: { message: 'Unauthenticated' } });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering (nginx/railway) so events flush immediately.
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();

    const sink: RealtimeSink = {
      write: (chunk: string) => res.write(chunk),
      end: () => {
        try {
          res.end();
        } catch {
          /* already ended */
        }
      },
      onDrain: (cb: () => void) => res.on('drain', cb),
    };

    const result = this.hub.register(adminUserId, sink);
    if (!result.ok || !result.connectionId) {
      // Limit reached / disabled — inform the client via a terminal SSE comment.
      res.write(`: rejected ${result.reason ?? 'unavailable'}\n\n`);
      res.end();
      return;
    }

    const connectionId = result.connectionId;
    const cleanup = (): void => this.hub.remove(connectionId);
    req.on('close', cleanup);
    req.on('error', cleanup);
    res.on('error', cleanup);
  }

  @Get('status')
  @Permissions(PERMISSION_USERS_READ)
  status() {
    return successResponse(this.hub.getStats());
  }
}
