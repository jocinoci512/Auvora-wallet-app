import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type Redis from 'ioredis';
import {
  ADMIN_EVENTS_CHANNEL,
  sanitizeAdminEvent,
  serializeAdminEvent,
  type AdminEvent,
} from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { REDIS_PORT, type RedisPort } from '../../infrastructure/redis/redis.port';

/**
 * Transport-agnostic sink the hub writes SSE frames to. The controller adapts an
 * Express `Response` to this; tests use an in-memory fake. This keeps the hub
 * fully unit-testable without HTTP or Redis.
 */
export interface RealtimeSink {
  write(chunk: string): boolean;
  end(): void;
  onDrain(cb: () => void): void;
}

export interface RegisterResult {
  ok: boolean;
  connectionId?: string;
  reason?: 'per_admin_limit' | 'global_limit' | 'disabled';
}

export interface HubStats {
  global: number;
  admins: number;
  maxPerAdmin: number;
  maxGlobal: number;
}

class RealtimeConnection {
  readonly buffer: string[] = [];
  private writable = true;
  private closed = false;

  constructor(
    readonly id: string,
    readonly adminUserId: string,
    private readonly sink: RealtimeSink,
    private readonly maxBuffer: number,
    private readonly onOverflow: (id: string) => void,
  ) {
    this.sink.onDrain(() => {
      this.writable = true;
      this.flush();
    });
  }

  /** Enqueue a raw SSE frame. Drops the connection if a slow client overflows. */
  enqueueFrame(frame: string): void {
    if (this.closed) return;
    if (this.buffer.length >= this.maxBuffer) {
      // Slow-client backpressure strategy: disconnect rather than grow unbounded.
      this.onOverflow(this.id);
      return;
    }
    this.buffer.push(frame);
    this.flush();
  }

  private flush(): void {
    if (this.closed) return;
    while (this.writable && this.buffer.length > 0) {
      const frame = this.buffer.shift() as string;
      const ok = this.sink.write(frame);
      if (!ok) {
        this.writable = false;
        return;
      }
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.buffer.length = 0;
    try {
      this.sink.end();
    } catch {
      /* already closed */
    }
  }
}

/**
 * The admin realtime hub. A single dedicated Redis subscriber fans out sanitised
 * events to all registered SSE connections. One shared subscriber listener and
 * one shared heartbeat timer are used regardless of connection count, so there is
 * never a MaxListenersExceededWarning.
 */
@Injectable()
export class RealtimeHubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeHubService.name);
  private readonly connections = new Map<string, RealtimeConnection>();
  private readonly byAdmin = new Map<string, Set<string>>();
  private subscriber?: Redis;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private initialized = false;
  private counter = 0;
  private readonly recentEventIds: string[] = [];
  private readonly recentEventIdSet = new Set<string>();

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(REDIS_PORT) private readonly redis: RedisPort,
  ) {}

  onModuleInit(): void {
    if (this.initialized) return; // duplicate subscription prevention
    this.initialized = true;
    if (!this.env.ADMIN_REALTIME_ENABLED) {
      this.logger.log('Admin realtime disabled via ADMIN_REALTIME_ENABLED=false');
      return;
    }
    this.startSubscriber();
    this.startHeartbeat();
  }

  private startSubscriber(): void {
    try {
      const sub = this.redis.createSubscriber();
      this.subscriber = sub;
      sub.on('error', (err: Error) => {
        // Never crash the process on Redis errors; ioredis retries per its bounded strategy.
        this.logger.warn(`Realtime subscriber error: ${err.message}`);
      });
      sub.on('end', () => {
        this.logger.warn('Realtime subscriber connection ended');
      });
      sub.on('message', (channel: string, message: string) => {
        this.handleMessage(channel, message);
      });
      void sub.subscribe(ADMIN_EVENTS_CHANNEL).catch((err: unknown) => {
        this.logger.warn(
          `Failed to subscribe to ${ADMIN_EVENTS_CHANNEL}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
      this.logger.log(`Realtime hub subscribed to ${ADMIN_EVENTS_CHANNEL}`);
    } catch (err) {
      this.logger.warn(
        `Realtime subscriber unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      const frame = `: heartbeat ${Date.now()}\n\n`;
      for (const conn of this.connections.values()) {
        conn.enqueueFrame(frame);
      }
    }, this.env.ADMIN_REALTIME_HEARTBEAT_MS);
    // Do not keep the event loop alive solely for heartbeats.
    this.heartbeatTimer.unref?.();
  }

  /** Parse + re-sanitise an incoming Redis message and fan it out. */
  handleMessage(channel: string, message: string): void {
    if (channel !== ADMIN_EVENTS_CHANNEL) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      this.logger.debug('Dropped non-JSON realtime message');
      return;
    }
    // Re-sanitise before delivery: defence-in-depth so nothing bypasses the filter.
    const event = sanitizeAdminEvent(parsed);
    if (!event) return;
    this.deliver(event);
  }

  private deliver(event: AdminEvent): void {
    if (this.recentEventIdSet.has(event.id)) return;
    this.recentEventIdSet.add(event.id);
    this.recentEventIds.push(event.id);
    if (this.recentEventIds.length > 512) {
      const expired = this.recentEventIds.shift();
      if (expired) this.recentEventIdSet.delete(expired);
    }
    const frame = `id: ${event.id}\nevent: ${event.type}\ndata: ${serializeAdminEvent(event)}\n\n`;
    for (const conn of this.connections.values()) {
      conn.enqueueFrame(frame);
    }
  }

  /** Register a new SSE connection, enforcing per-admin and global limits. */
  register(adminUserId: string, sink: RealtimeSink): RegisterResult {
    if (!this.env.ADMIN_REALTIME_ENABLED) {
      return { ok: false, reason: 'disabled' };
    }
    if (this.connections.size >= this.env.ADMIN_REALTIME_MAX_GLOBAL) {
      return { ok: false, reason: 'global_limit' };
    }
    const existing = this.byAdmin.get(adminUserId);
    if (existing && existing.size >= this.env.ADMIN_REALTIME_MAX_PER_ADMIN) {
      return { ok: false, reason: 'per_admin_limit' };
    }

    this.counter += 1;
    const id = `conn_${Date.now().toString(36)}_${this.counter.toString(36)}`;
    const conn = new RealtimeConnection(
      id,
      adminUserId,
      sink,
      this.env.ADMIN_REALTIME_CLIENT_BUFFER,
      (overflowId) => this.remove(overflowId),
    );
    this.connections.set(id, conn);
    const set = existing ?? new Set<string>();
    set.add(id);
    this.byAdmin.set(adminUserId, set);

    // SSE preamble: reconnect hint + confirmation comment.
    conn.enqueueFrame(`retry: 5000\n`);
    conn.enqueueFrame(`: connected ${id}\n\n`);
    return { ok: true, connectionId: id };
  }

  /** Remove and close a connection. Idempotent. */
  remove(connectionId: string): void {
    const conn = this.connections.get(connectionId);
    if (!conn) return;
    this.connections.delete(connectionId);
    const set = this.byAdmin.get(conn.adminUserId);
    if (set) {
      set.delete(connectionId);
      if (set.size === 0) this.byAdmin.delete(conn.adminUserId);
    }
    conn.close();
  }

  getStats(): HubStats {
    return {
      global: this.connections.size,
      admins: this.byAdmin.size,
      maxPerAdmin: this.env.ADMIN_REALTIME_MAX_PER_ADMIN,
      maxGlobal: this.env.ADMIN_REALTIME_MAX_GLOBAL,
    };
  }

  connectionCount(): number {
    return this.connections.size;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    for (const id of [...this.connections.keys()]) {
      this.remove(id);
    }
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch {
        try {
          this.subscriber.disconnect();
        } catch {
          /* already closed */
        }
      }
      this.subscriber = undefined;
    }
  }
}
