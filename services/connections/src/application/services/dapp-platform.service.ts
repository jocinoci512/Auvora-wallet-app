import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  type ChainNetwork,
  type DappPermissionCode,
  type Prisma,
  PrismaService,
} from '@auvora/database';
import { createHash, randomBytes } from 'node:crypto';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  assertSupportedNetworks,
  assertValidPermissions,
  DAPP_PERMISSION_LABELS,
  DAPP_PERMISSIONS,
  isReadOnlyNetwork,
  normalizeOrigin,
  type DappPermission,
  WEB3_SUPPORTED_NETWORKS,
} from '../../domain/dapp-permissions';
import {
  ConnectionsNotFoundError,
  ConnectionsPermissionDeniedError,
  ConnectionsReplayError,
  ConnectionsUnsupportedError,
  ConnectionsValidationError,
} from '../../domain/errors';
import { CONNECTIONS_EVENTS } from '../../domain/events';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';
import { ConnectionsEngineService } from './connections-engine.service';

@Injectable()
export class DappPlatformService {
  private readonly logger = new Logger(DappPlatformService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(ConnectionsEngineService) private readonly connections: ConnectionsEngineService,
  ) {}

  getPlatformStatus() {
    return {
      platform: 'web3-dapp-connectivity',
      phase: 26,
      supportedNetworks: [...WEB3_SUPPORTED_NETWORKS],
      permissions: [...DAPP_PERMISSIONS],
      permissionLabels: DAPP_PERMISSION_LABELS,
      readOnlyNetworks: WEB3_SUPPORTED_NETWORKS.filter((n) => isReadOnlyNetwork(n)),
      sessionTtlSeconds: this.env.CONNECTIONS_SESSION_TTL_SECONDS,
      features: {
        connectionRequests: true,
        permissionGrants: true,
        trustedDapps: true,
        sessionManagement: true,
        typedDataSigning: true,
        dappBrowser: true,
        bitcoinReadOnly: true,
      },
    };
  }

  async createConnectionRequest(
    userId: string,
    input: {
      origin: string;
      name: string;
      iconUrl?: string;
      networks: ChainNetwork[];
      permissions: string[];
      proposalNonce?: string;
    },
  ) {
    const origin = normalizeOrigin(input.origin);
    assertSupportedNetworks(input.networks);
    const permissions = assertValidPermissions(input.permissions);
    const nonce = input.proposalNonce?.trim() || randomBytes(16).toString('hex');

    const existingNonce = await this.prisma.dappConnectionRequest.findUnique({
      where: { proposalNonce: nonce },
    });
    if (existingNonce) {
      throw new ConnectionsReplayError('proposalNonce already used');
    }

    const expiresAt = new Date(
      this.clock.now().getTime() + this.env.CONNECTIONS_SESSION_TTL_SECONDS * 1000,
    );
    const request = await this.prisma.dappConnectionRequest.create({
      data: {
        id: this.ids.uuid(),
        userId,
        origin,
        name: input.name.slice(0, 120),
        iconUrl: input.iconUrl,
        requestedNetworks: input.networks as unknown as Prisma.InputJsonValue,
        requestedPermissions: permissions as unknown as Prisma.InputJsonValue,
        status: 'PENDING',
        proposalNonce: nonce,
        expiresAt,
      },
    });

    await this.recordActivity(userId, origin, null, CONNECTIONS_EVENTS.DAPP_REQUEST_CREATED, {
      summary: `Connection request from ${input.name}`,
      requestId: request.id,
    });
    void this.analytics.publishEvent({
      eventType: CONNECTIONS_EVENTS.DAPP_REQUEST_CREATED,
      aggregateId: request.id,
      payload: { userId, origin, permissions },
    });
    void this.notifications.publishEvent({
      eventType: CONNECTIONS_EVENTS.DAPP_REQUEST_CREATED,
      aggregateId: request.id,
      payload: {
        userId,
        title: 'dApp connection request',
        body: `${input.name} wants to connect (${origin})`,
      },
    });
    return request;
  }

  async listConnectionRequests(userId: string, status?: string) {
    return this.prisma.dappConnectionRequest.findMany({
      where: {
        userId,
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async approveConnectionRequest(
    userId: string,
    requestId: string,
    input: { accounts: string[]; trustDapp?: boolean; permissions?: string[] },
  ) {
    const started = Date.now();
    const request = await this.prisma.dappConnectionRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) throw new ConnectionsNotFoundError('Connection request not found');
    if (request.status !== 'PENDING') {
      throw new ConnectionsValidationError(`Request is ${request.status}`);
    }
    if (request.expiresAt.getTime() <= this.clock.now().getTime()) {
      await this.prisma.dappConnectionRequest.update({
        where: { id: request.id },
        data: { status: 'EXPIRED', decidedAt: this.clock.now() },
      });
      throw new ConnectionsValidationError('Connection request expired');
    }
    if (!input.accounts?.length) {
      throw new ConnectionsValidationError('At least one account is required');
    }

    const networks = request.requestedNetworks as unknown as ChainNetwork[];
    const permissions = assertValidPermissions(
      (input.permissions ?? (request.requestedPermissions as unknown as string[])).map(String),
    );

    for (const network of networks) {
      if (isReadOnlyNetwork(network) && permissions.includes('REQUEST_TRANSACTIONS')) {
        throw new ConnectionsUnsupportedError(
          'Bitcoin dApp connections are read-only — REQUEST_TRANSACTIONS is not allowed',
          { network },
        );
      }
    }

    const sessionResult = await this.connections.createWalletConnectSession(userId, {
      networks,
      permissions,
    });
    const approvedSession = await this.connections.approveSession(
      userId,
      sessionResult.session.id,
      input.accounts,
    );

    let trustedDappId: string | undefined;
    if (input.trustDapp !== false) {
      const trusted = await this.prisma.trustedDapp.upsert({
        where: { userId_origin: { userId, origin: request.origin } },
        create: {
          id: this.ids.uuid(),
          userId,
          origin: request.origin,
          name: request.name,
          iconUrl: request.iconUrl,
          networks: networks as unknown as Prisma.InputJsonValue,
          defaultPermissions: permissions as unknown as Prisma.InputJsonValue,
          status: 'TRUSTED',
          lastConnectedAt: this.clock.now(),
        },
        update: {
          name: request.name,
          iconUrl: request.iconUrl,
          networks: networks as unknown as Prisma.InputJsonValue,
          defaultPermissions: permissions as unknown as Prisma.InputJsonValue,
          status: 'TRUSTED',
          revokedAt: null,
          lastConnectedAt: this.clock.now(),
        },
      });
      trustedDappId = trusted.id;
      void this.analytics.publishEvent({
        eventType: CONNECTIONS_EVENTS.DAPP_TRUSTED,
        aggregateId: trusted.id,
        payload: { userId, origin: request.origin },
      });
    }

    await this.syncPermissionGrants(userId, request.origin, permissions, {
      sessionId: approvedSession.id,
      trustedDappId,
    });

    const updated = await this.prisma.dappConnectionRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        sessionId: approvedSession.id,
        decidedAt: this.clock.now(),
        requestedPermissions: permissions as unknown as Prisma.InputJsonValue,
      },
    });

    await this.recordActivity(
      userId,
      request.origin,
      approvedSession.id,
      CONNECTIONS_EVENTS.DAPP_REQUEST_APPROVED,
      {
        summary: `Approved ${request.name}`,
        approvalLatencyMs: Date.now() - started,
      },
    );
    void this.analytics.publishEvent({
      eventType: CONNECTIONS_EVENTS.DAPP_REQUEST_APPROVED,
      aggregateId: updated.id,
      payload: { userId, origin: request.origin, approvalLatencyMs: Date.now() - started },
    });
    return { request: updated, session: approvedSession, permissions };
  }

  async rejectConnectionRequest(userId: string, requestId: string) {
    const request = await this.prisma.dappConnectionRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) throw new ConnectionsNotFoundError('Connection request not found');
    if (request.status !== 'PENDING') {
      throw new ConnectionsValidationError(`Request is ${request.status}`);
    }
    const updated = await this.prisma.dappConnectionRequest.update({
      where: { id: request.id },
      data: { status: 'REJECTED', decidedAt: this.clock.now() },
    });
    await this.recordActivity(
      userId,
      request.origin,
      null,
      CONNECTIONS_EVENTS.DAPP_REQUEST_REJECTED,
      {
        summary: `Rejected ${request.name}`,
      },
    );
    return updated;
  }

  async listTrustedDapps(userId: string) {
    return this.prisma.trustedDapp.findMany({
      where: { userId, status: 'TRUSTED' },
      orderBy: { lastConnectedAt: 'desc' },
    });
  }

  async revokeTrustedDapp(userId: string, trustedDappId: string) {
    const row = await this.prisma.trustedDapp.findFirst({
      where: { id: trustedDappId, userId },
    });
    if (!row) throw new ConnectionsNotFoundError('Trusted dApp not found');
    const updated = await this.prisma.trustedDapp.update({
      where: { id: row.id },
      data: { status: 'REVOKED', revokedAt: this.clock.now() },
    });
    await this.prisma.dappPermissionGrant.updateMany({
      where: { userId, origin: row.origin, revokedAt: null },
      data: { allowed: false, revokedAt: this.clock.now() },
    });
    await this.recordActivity(userId, row.origin, null, CONNECTIONS_EVENTS.DAPP_REVOKED, {
      summary: `Revoked trust for ${row.name}`,
    });
    return updated;
  }

  async listPermissions(userId: string, origin?: string) {
    return this.prisma.dappPermissionGrant.findMany({
      where: {
        userId,
        ...(origin ? { origin: normalizeOrigin(origin) } : {}),
        revokedAt: null,
      },
      orderBy: [{ origin: 'asc' }, { permission: 'asc' }],
    });
  }

  async updatePermission(
    userId: string,
    input: { origin: string; permission: string; allowed: boolean; expiresAt?: string },
  ) {
    const origin = normalizeOrigin(input.origin);
    const [permission] = assertValidPermissions([input.permission]);
    const grant = await this.prisma.dappPermissionGrant.upsert({
      where: {
        userId_origin_permission: {
          userId,
          origin,
          permission: permission as DappPermissionCode,
        },
      },
      create: {
        id: this.ids.uuid(),
        userId,
        origin,
        permission: permission as DappPermissionCode,
        allowed: input.allowed,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
      update: {
        allowed: input.allowed,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        revokedAt: input.allowed ? null : this.clock.now(),
      },
    });
    await this.recordActivity(
      userId,
      origin,
      grant.sessionId,
      CONNECTIONS_EVENTS.DAPP_PERMISSION_UPDATED,
      {
        summary: `${permission} => ${input.allowed ? 'allowed' : 'denied'}`,
      },
    );
    return grant;
  }

  async assertPermission(userId: string, originRaw: string, permission: DappPermission) {
    const origin = normalizeOrigin(originRaw);
    const grant = await this.prisma.dappPermissionGrant.findUnique({
      where: {
        userId_origin_permission: {
          userId,
          origin,
          permission: permission as DappPermissionCode,
        },
      },
    });
    if (!grant || !grant.allowed || grant.revokedAt) {
      throw new ConnectionsPermissionDeniedError(`${permission} not granted for ${origin}`);
    }
    if (grant.expiresAt && grant.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new ConnectionsPermissionDeniedError(`${permission} expired for ${origin}`);
    }
    return grant;
  }

  async prepareDappSign(
    userId: string,
    input: {
      origin: string;
      kind: 'HARDWARE' | 'WALLETCONNECT' | 'BROWSER' | 'READONLY';
      connectionRef: string;
      network: ChainNetwork;
      payloadType: 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA';
      payload: string;
      feeEstimate?: string;
    },
  ) {
    const origin = normalizeOrigin(input.origin);
    assertSupportedNetworks([input.network]);
    if (isReadOnlyNetwork(input.network) && input.payloadType === 'TRANSACTION') {
      throw new ConnectionsUnsupportedError('Bitcoin does not support dApp transaction signing');
    }
    const required: DappPermission =
      input.payloadType === 'TRANSACTION' ? 'REQUEST_TRANSACTIONS' : 'REQUEST_SIGNATURES';
    await this.assertPermission(userId, origin, required);

    const prepared = await this.connections.prepareSign(userId, {
      kind: input.kind,
      connectionRef: input.connectionRef,
      network: input.network,
      payloadType: input.payloadType,
      payload: input.payload,
      feeEstimate: input.feeEstimate,
    });

    const hash = createHash('sha256').update(input.payload).digest('hex');
    await this.recordActivity(userId, origin, null, CONNECTIONS_EVENTS.SIGN_PREPARED, {
      summary: `${input.payloadType} signing preview (${input.network})`,
      payloadHash: hash,
      requestId: prepared.requestId,
      typedData: input.payloadType === 'TYPED_DATA',
    });
    return {
      ...prepared,
      payloadType: input.payloadType,
      origin,
      preview: {
        type: input.payloadType,
        network: input.network,
        providerPreview: prepared.prepared?.preview,
        feeEstimate: prepared.prepared?.feeEstimate,
        payloadHash: hash,
        safe: true,
      },
    };
  }

  async listBookmarks(userId: string) {
    return this.prisma.dappBrowserBookmark.findMany({
      where: { userId },
      orderBy: [{ lastVisitedAt: 'desc' }, { updatedAt: 'desc' }],
      take: 100,
    });
  }

  async visitDapp(userId: string, input: { url: string; title?: string; faviconUrl?: string }) {
    let parsed: URL;
    try {
      parsed = new URL(input.url);
    } catch {
      throw new ConnectionsValidationError('Invalid dApp URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ConnectionsValidationError('Only http(s) dApp URLs are allowed');
    }
    const origin = parsed.origin.toLowerCase();
    const trusted = await this.prisma.trustedDapp.findUnique({
      where: { userId_origin: { userId, origin } },
    });
    const bookmark = await this.prisma.dappBrowserBookmark.upsert({
      where: { userId_url: { userId, url: parsed.toString() } },
      create: {
        id: this.ids.uuid(),
        userId,
        url: parsed.toString(),
        title: input.title ?? parsed.hostname,
        origin,
        faviconUrl: input.faviconUrl,
        lastVisitedAt: this.clock.now(),
        visitCount: 1,
        isTrusted: trusted?.status === 'TRUSTED',
      },
      update: {
        title: input.title ?? parsed.hostname,
        faviconUrl: input.faviconUrl,
        lastVisitedAt: this.clock.now(),
        visitCount: { increment: 1 },
        isTrusted: trusted?.status === 'TRUSTED',
      },
    });
    await this.recordActivity(userId, origin, null, CONNECTIONS_EVENTS.DAPP_BROWSER_VISITED, {
      summary: `Visited ${bookmark.title}`,
      url: bookmark.url,
    });
    return {
      bookmark,
      security: {
        origin,
        isTrusted: bookmark.isTrusted,
        warning: bookmark.isTrusted
          ? null
          : 'This origin is not in your trusted dApps list. Review permissions carefully.',
      },
    };
  }

  async removeBookmark(userId: string, bookmarkId: string) {
    const row = await this.prisma.dappBrowserBookmark.findFirst({
      where: { id: bookmarkId, userId },
    });
    if (!row) throw new ConnectionsNotFoundError('Bookmark not found');
    await this.prisma.dappBrowserBookmark.delete({ where: { id: row.id } });
    return { id: bookmarkId, deleted: true };
  }

  async listActivity(userId: string) {
    return this.prisma.dappActivityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async sessionSummary(userId: string) {
    const [active, pendingRequests, trusted, grants] = await Promise.all([
      this.prisma.walletConnectSession.count({ where: { userId, status: 'ACTIVE' } }),
      this.prisma.dappConnectionRequest.count({ where: { userId, status: 'PENDING' } }),
      this.prisma.trustedDapp.count({ where: { userId, status: 'TRUSTED' } }),
      this.prisma.dappPermissionGrant.count({ where: { userId, allowed: true, revokedAt: null } }),
    ]);
    return {
      activeSessions: active,
      pendingConnectionRequests: pendingRequests,
      trustedDapps: trusted,
      activePermissionGrants: grants,
      supportedNetworks: [...WEB3_SUPPORTED_NETWORKS],
    };
  }

  async expireStaleRequests(): Promise<number> {
    const result = await this.prisma.dappConnectionRequest.updateMany({
      where: { status: 'PENDING', expiresAt: { lte: this.clock.now() } },
      data: { status: 'EXPIRED', decidedAt: this.clock.now() },
    });
    return result.count;
  }

  async expireStalePermissions(): Promise<number> {
    const result = await this.prisma.dappPermissionGrant.updateMany({
      where: {
        allowed: true,
        revokedAt: null,
        expiresAt: { lte: this.clock.now() },
      },
      data: { allowed: false, revokedAt: this.clock.now() },
    });
    return result.count;
  }

  private async syncPermissionGrants(
    userId: string,
    origin: string,
    permissions: DappPermission[],
    refs: { sessionId?: string; trustedDappId?: string },
  ) {
    for (const permission of permissions) {
      await this.prisma.dappPermissionGrant.upsert({
        where: {
          userId_origin_permission: {
            userId,
            origin,
            permission: permission as DappPermissionCode,
          },
        },
        create: {
          id: this.ids.uuid(),
          userId,
          origin,
          permission: permission as DappPermissionCode,
          allowed: true,
          sessionId: refs.sessionId,
          trustedDappId: refs.trustedDappId,
        },
        update: {
          allowed: true,
          revokedAt: null,
          sessionId: refs.sessionId,
          trustedDappId: refs.trustedDappId,
        },
      });
    }
  }

  private async recordActivity(
    userId: string,
    origin: string | null,
    sessionId: string | null,
    eventType: string,
    metadata: Record<string, unknown> & { summary: string },
  ) {
    const { summary, ...rest } = metadata;
    try {
      await this.prisma.dappActivityEvent.create({
        data: {
          id: this.ids.uuid(),
          userId,
          origin: origin ?? undefined,
          sessionId: sessionId ?? undefined,
          eventType,
          summary,
          metadata: rest as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to record dApp activity: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
