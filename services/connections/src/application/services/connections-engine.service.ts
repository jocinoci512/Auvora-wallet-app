import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { type ChainNetwork, type Prisma, PrismaService } from '@auvora/database';
import type { ConnectionKind } from '../../domain/connection-provider.port';
import {
  CONNECTION_PROVIDER,
  type ConnectionProviderPort,
} from '../../domain/connection-provider.port';
import {
  ConnectionsNotFoundError,
  ConnectionsSigningNotAllowedError,
  ConnectionsUnsupportedError,
  ConnectionsValidationError,
} from '../../domain/errors';
import { CONNECTIONS_EVENTS } from '../../domain/events';
import {
  EVM_OWNERSHIP_NETWORKS,
  isSupportedPublicNetwork,
  validatePublicAddressFormat,
} from '../../domain/supported-networks';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ADMIN_EVENT_PUBLISHER,
  type AdminEventInput,
  type AdminEventPublisherPort,
} from '../../infrastructure/realtime/admin-event-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  addressesEqual,
  recoverPersonalSignAddress,
} from '../../infrastructure/crypto/eth-personal-sign';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';
import {
  FIELD_ENCRYPTION,
  type FieldEncryptionPort,
} from '../../infrastructure/crypto/field-encryption.adapter';
import { ENV, type ServiceEnv } from '../../config/env.schema';

function redactWalletConnectSecrets(value?: string | null): string | null | undefined {
  if (value == null) return value;
  return value.replace(/([?&]symKey=)[^&]+/gi, '$1[REDACTED]');
}

@Injectable()
export class ConnectionsEngineService {
  private readonly logger = new Logger(ConnectionsEngineService.name);

  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CONNECTION_PROVIDER) private readonly providers: ConnectionProviderPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
    @Inject(ADMIN_EVENT_PUBLISHER) private readonly adminEvents: AdminEventPublisherPort,
  ) {}

  /** Fire-and-forget safe admin realtime emit; never throws into a domain flow. */
  private emitAdminEvent(input: AdminEventInput): void {
    void this.adminEvents.publish(input).catch(() => undefined);
  }

  listCapabilities() {
    return this.providers.listCapabilities?.() ?? [this.providers.getCapabilities()];
  }

  async discoverDevices() {
    return this.providers.discoverDevices();
  }

  async pairDevice(userId: string, deviceId: string) {
    const started = Date.now();
    const paired = await this.providers.pairDevice(deviceId);
    // `deviceId` is globally unique; never let one user's pairing mutate another
    // user's device record (cross-user IDOR).
    const existing = await this.prisma.hardwareDevice.findUnique({
      where: { deviceId: paired.deviceId },
      select: { userId: true },
    });
    if (existing && existing.userId !== userId) {
      throw new ConnectionsValidationError('Device is already paired to another account');
    }
    const device = await this.prisma.hardwareDevice.upsert({
      where: { deviceId: paired.deviceId },
      create: {
        id: this.ids.uuid(),
        userId,
        deviceId: paired.deviceId,
        vendor: paired.vendor,
        model: paired.model,
        transport: paired.transport,
        firmwareVersion: paired.firmwareVersion,
        firmwareCompatible: paired.firmwareCompatible,
        status: paired.status,
        accounts: paired.accounts as unknown as Prisma.InputJsonValue,
        pairedAt: this.clock.now(),
        lastSeenAt: this.clock.now(),
      },
      update: {
        status: paired.status,
        firmwareVersion: paired.firmwareVersion,
        firmwareCompatible: paired.firmwareCompatible,
        accounts: paired.accounts as unknown as Prisma.InputJsonValue,
        lastSeenAt: this.clock.now(),
      },
    });
    await this.prisma.externalWalletConnection.create({
      data: {
        id: this.ids.uuid(),
        userId,
        kind: 'HARDWARE',
        providerCode: this.providers.code,
        status: 'CONNECTED',
        label: `${paired.vendor} ${paired.model}`,
        externalRef: paired.deviceId,
        canSign: true,
        metadata: { accounts: paired.accounts } as Prisma.InputJsonValue,
        connectedAt: this.clock.now(),
      },
    });
    void this.analytics.publishEvent({
      eventType: CONNECTIONS_EVENTS.DEVICE_PAIRED,
      aggregateId: device.id,
      payload: { userId, deviceId, latencyMs: Date.now() - started },
    });
    void this.notifications.publishEvent({
      eventType: CONNECTIONS_EVENTS.DEVICE_PAIRED,
      aggregateId: device.id,
      payload: { userId, title: 'Hardware wallet paired', body: paired.model },
    });
    this.emitAdminEvent({
      type: 'CONNECTION_CREATED',
      userId,
      targetId: paired.deviceId,
      metadata: { kind: 'HARDWARE', status: 'CONNECTED', provider: this.providers.code },
    });
    return { device, paired };
  }

  async disconnectDevice(userId: string, deviceId: string) {
    const device = await this.prisma.hardwareDevice.findFirst({ where: { userId, deviceId } });
    if (!device) throw new ConnectionsNotFoundError('Device not found');
    await this.providers.disconnectDevice(deviceId);
    await this.prisma.hardwareDevice.update({
      where: { id: device.id },
      data: { status: 'DISCONNECTED', lastSeenAt: this.clock.now() },
    });
    await this.prisma.externalWalletConnection.updateMany({
      where: { userId, externalRef: deviceId, kind: 'HARDWARE' },
      data: { status: 'DISCONNECTED', disconnectedAt: this.clock.now() },
    });
    void this.notifications.publishEvent({
      eventType: CONNECTIONS_EVENTS.DEVICE_DISCONNECTED,
      aggregateId: device.id,
      payload: { userId, deviceId },
    });
    this.emitAdminEvent({
      type: 'CONNECTION_DISCONNECTED',
      userId,
      targetId: deviceId,
      severity: 'warning',
      metadata: { kind: 'HARDWARE', status: 'DISCONNECTED' },
    });
    return { deviceId, status: 'DISCONNECTED' };
  }

  async listDevices(userId: string) {
    return this.prisma.hardwareDevice.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createWalletConnectSession(
    userId: string,
    input: { networks: ChainNetwork[]; permissions?: string[] },
  ) {
    const proposal = await this.providers.createWalletConnectProposal({
      networks: input.networks,
      permissions: input.permissions ?? ['accounts', 'sign'],
    });
    const encryptedUri = this.crypto.encrypt(proposal.uri);
    const session = await this.prisma.walletConnectSession.create({
      data: {
        id: this.ids.uuid(),
        userId,
        proposalId: proposal.proposalId,
        topic: proposal.topic,
        status: 'PENDING',
        peerName: 'Pending DApp',
        networks: input.networks,
        permissions: proposal.permissions,
        accounts: [],
        encryptedUri,
        qrPayload: proposal.qrPayload,
        deepLink: proposal.deepLink,
        expiresAt: new Date(proposal.expiresAt),
      },
    });
    void this.analytics.publishEvent({
      eventType: CONNECTIONS_EVENTS.SESSION_CREATED,
      aggregateId: session.id,
      payload: { userId, proposalId: proposal.proposalId },
    });
    return { session, proposal };
  }

  async approveSession(userId: string, sessionId: string, accounts: string[]) {
    const row = await this.prisma.walletConnectSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row?.proposalId) throw new ConnectionsNotFoundError('Session not found');
    const approved = await this.providers.approveSession(row.proposalId, accounts);
    const updated = await this.prisma.walletConnectSession.update({
      where: { id: row.id },
      data: {
        sessionKey: approved.sessionId,
        status: 'ACTIVE',
        peerName: approved.peerName,
        peerUrl: approved.peerUrl,
        accounts,
        approvedAt: this.clock.now(),
        expiresAt: new Date(approved.expiresAt),
      },
    });
    await this.prisma.externalWalletConnection.create({
      data: {
        id: this.ids.uuid(),
        userId,
        kind: 'WALLETCONNECT',
        providerCode: 'walletconnect_sim',
        status: 'CONNECTED',
        label: approved.peerName,
        externalRef: approved.sessionId,
        canSign: true,
        metadata: { accounts, networks: approved.networks } as Prisma.InputJsonValue,
        connectedAt: this.clock.now(),
      },
    });
    void this.notifications.publishEvent({
      eventType: CONNECTIONS_EVENTS.SESSION_APPROVED,
      aggregateId: updated.id,
      payload: { userId, sessionId },
    });
    this.emitAdminEvent({
      type: 'CONNECTION_CREATED',
      userId,
      targetId: approved.sessionId,
      metadata: { kind: 'WALLETCONNECT', status: 'CONNECTED', provider: 'walletconnect' },
    });
    return updated;
  }

  async rejectSession(userId: string, sessionId: string) {
    const row = await this.prisma.walletConnectSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row?.proposalId) throw new ConnectionsNotFoundError('Session not found');
    await this.providers.rejectSession(row.proposalId);
    const updated = await this.prisma.walletConnectSession.update({
      where: { id: row.id },
      data: { status: 'REJECTED', rejectedAt: this.clock.now() },
    });
    void this.analytics.publishEvent({
      eventType: CONNECTIONS_EVENTS.SESSION_REJECTED,
      aggregateId: updated.id,
      payload: { userId, sessionId },
    });
    return updated;
  }

  async restoreSession(userId: string, sessionId: string) {
    const row = await this.prisma.walletConnectSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row?.sessionKey) throw new ConnectionsNotFoundError('Session not found');
    const restored = await this.providers.restoreSession(row.sessionKey);
    if (!restored || restored.status !== 'ACTIVE') {
      throw new ConnectionsNotFoundError('Session cannot be restored');
    }
    return this.prisma.walletConnectSession.update({
      where: { id: row.id },
      data: { status: 'ACTIVE', lastRestoredAt: this.clock.now() },
    });
  }

  async terminateSession(userId: string, sessionId: string) {
    const row = await this.prisma.walletConnectSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row) throw new ConnectionsNotFoundError('Session not found');
    if (row.sessionKey) await this.providers.terminateSession(row.sessionKey);
    await this.prisma.walletConnectSession.update({
      where: { id: row.id },
      data: { status: 'TERMINATED', terminatedAt: this.clock.now() },
    });
    void this.notifications.publishEvent({
      eventType: CONNECTIONS_EVENTS.SESSION_TERMINATED,
      aggregateId: row.id,
      payload: { userId, sessionId },
    });
    this.emitAdminEvent({
      type: 'CONNECTION_DISCONNECTED',
      userId,
      targetId: sessionId,
      severity: 'warning',
      metadata: { kind: 'WALLETCONNECT', status: 'TERMINATED' },
    });
    return { sessionId, status: 'TERMINATED' };
  }

  async listSessions(userId: string) {
    const sessions = await this.prisma.walletConnectSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return sessions.map(({ encryptedUri: _encryptedUri, qrPayload, deepLink, ...rest }) => {
      const pairingMaterialAllowed = rest.status === 'PENDING';
      return {
        ...rest,
        // ACTIVE/terminated sessions must not re-expose WC symKey; PENDING may return pairing material once.
        qrPayload: pairingMaterialAllowed
          ? (qrPayload ?? undefined)
          : (redactWalletConnectSecrets(qrPayload) ?? undefined),
        deepLink: pairingMaterialAllowed
          ? (deepLink ?? undefined)
          : (redactWalletConnectSecrets(deepLink) ?? undefined),
        hasEncryptedUri: Boolean(_encryptedUri),
      };
    });
  }

  async listBrowserWallets() {
    return this.providers.listBrowserWallets();
  }

  async connectBrowserWallet(userId: string, providerId: string) {
    const connected = await this.providers.connectBrowserWallet(providerId);
    const connection = await this.prisma.externalWalletConnection.create({
      data: {
        id: this.ids.uuid(),
        userId,
        kind: 'BROWSER',
        providerCode: providerId,
        status: 'CONNECTED',
        label: connected.name,
        externalRef: providerId,
        canSign: true,
        metadata: { accounts: connected.accounts } as Prisma.InputJsonValue,
        connectedAt: this.clock.now(),
      },
    });
    return { connection, connected };
  }

  async addWatchAddress(
    userId: string,
    input: { network: ChainNetwork; address: string; label?: string },
  ) {
    if (!isSupportedPublicNetwork(input.network)) {
      throw new ConnectionsValidationError(
        'Unsupported network. Allowed: BTC, ETH, SOL, BSC, TRON, Polygon.',
      );
    }
    const address = input.address.trim();
    if (!validatePublicAddressFormat(input.network, address)) {
      throw new ConnectionsValidationError(`Invalid ${input.network} address`);
    }
    // Reject accidental private-key shaped payloads (never accept custody material).
    if (/mnemonic|private.?key|seed/i.test(address) || address.split(/\s+/).length >= 12) {
      throw new ConnectionsValidationError('Private keys and seed phrases are never accepted');
    }
    const watch = await this.prisma.watchAddress.upsert({
      where: {
        userId_network_address: {
          userId,
          network: input.network,
          address,
        },
      },
      create: {
        id: this.ids.uuid(),
        userId,
        network: input.network,
        address,
        label: input.label ?? 'Watch address',
        status: 'ACTIVE',
        linkMode: 'watch_only',
      },
      update: { label: input.label ?? 'Watch address', status: 'ACTIVE' },
    });
    await this.prisma.externalWalletConnection.create({
      data: {
        id: this.ids.uuid(),
        userId,
        kind: 'READONLY',
        providerCode: 'watch',
        status: 'CONNECTED',
        label: watch.label,
        externalRef: watch.id,
        canSign: false,
        metadata: { network: input.network, address } as Prisma.InputJsonValue,
        connectedAt: this.clock.now(),
      },
    });
    void this.notifications.publishEvent({
      eventType: CONNECTIONS_EVENTS.WATCH_ADDED,
      aggregateId: watch.id,
      payload: { userId, address, network: input.network },
    });
    return watch;
  }

  async createOwnershipChallenge(
    userId: string,
    input: { network: ChainNetwork; address: string },
  ) {
    if (!isSupportedPublicNetwork(input.network)) {
      throw new ConnectionsValidationError(
        'Unsupported network. Allowed: BTC, ETH, SOL, BSC, TRON, Polygon.',
      );
    }
    const address = input.address.trim();
    if (!validatePublicAddressFormat(input.network, address)) {
      throw new ConnectionsValidationError(`Invalid ${input.network} address`);
    }
    if (!EVM_OWNERSHIP_NETWORKS.has(input.network)) {
      throw new ConnectionsUnsupportedError(
        'Ownership challenge signing is Alpha-ready for EVM chains (ETH / BSC / Polygon). Other chains can be registered as watch-only.',
        { network: input.network },
      );
    }
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(this.clock.now().getTime() + 10 * 60 * 1000);
    const message = [
      'Auvora account ownership challenge',
      `User: ${userId}`,
      `Network: ${input.network}`,
      `Address: ${address}`,
      `Nonce: ${nonce}`,
      `Expires: ${expiresAt.toISOString()}`,
      'Never share your seed phrase. Signing proves address control only.',
    ].join('\n');

    const challenge = await this.prisma.addressOwnershipChallenge.create({
      data: {
        id: this.ids.uuid(),
        userId,
        network: input.network,
        address,
        nonce,
        message,
        expiresAt,
      },
    });

    return {
      challengeId: challenge.id,
      nonce: challenge.nonce,
      message: challenge.message,
      expiresAt: challenge.expiresAt.toISOString(),
      network: challenge.network,
      address: challenge.address,
      signingMethod: 'personal_sign',
    };
  }

  async verifyOwnershipChallenge(
    userId: string,
    input: { challengeId: string; signature: string },
  ) {
    const challenge = await this.prisma.addressOwnershipChallenge.findFirst({
      where: { id: input.challengeId, userId },
    });
    if (!challenge) throw new ConnectionsNotFoundError('Ownership challenge not found');
    if (challenge.consumedAt) {
      throw new ConnectionsValidationError('Ownership challenge already used (replay blocked)');
    }
    if (challenge.expiresAt.getTime() <= this.clock.now().getTime()) {
      throw new ConnectionsValidationError('Ownership challenge expired');
    }
    if (!EVM_OWNERSHIP_NETWORKS.has(challenge.network)) {
      throw new ConnectionsUnsupportedError('Ownership verification unsupported for this network');
    }

    const recovered = recoverPersonalSignAddress(challenge.message, input.signature.trim());
    if (!recovered || !addressesEqual(recovered, challenge.address)) {
      throw new ConnectionsValidationError('Signature does not prove ownership of the address');
    }

    await this.prisma.addressOwnershipChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: this.clock.now() },
    });

    const watch = await this.prisma.watchAddress.upsert({
      where: {
        userId_network_address: {
          userId,
          network: challenge.network,
          address: challenge.address,
        },
      },
      create: {
        id: this.ids.uuid(),
        userId,
        network: challenge.network,
        address: challenge.address,
        label: 'Linked wallet',
        status: 'ACTIVE',
        linkMode: 'ownership_verified',
        ownershipVerifiedAt: this.clock.now(),
        metadata: { challengeId: challenge.id } as Prisma.InputJsonValue,
      },
      update: {
        status: 'ACTIVE',
        linkMode: 'ownership_verified',
        ownershipVerifiedAt: this.clock.now(),
        metadata: { challengeId: challenge.id } as Prisma.InputJsonValue,
      },
    });

    return {
      watchId: watch.id,
      network: watch.network,
      address: watch.address,
      linkMode: watch.linkMode,
      ownershipVerifiedAt: watch.ownershipVerifiedAt?.toISOString() ?? null,
      containsPrivateKeys: false,
    };
  }

  async listWatchAddresses(userId: string) {
    return this.prisma.watchAddress.findMany({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async removeWatchAddress(userId: string, watchId: string) {
    const watch = await this.prisma.watchAddress.findFirst({ where: { id: watchId, userId } });
    if (!watch) throw new ConnectionsNotFoundError('Watch address not found');
    await this.prisma.watchAddress.update({
      where: { id: watch.id },
      data: { status: 'REMOVED' },
    });
    return { id: watchId, status: 'REMOVED' };
  }

  async prepareSign(
    userId: string,
    input: {
      kind: ConnectionKind;
      connectionRef: string;
      network: ChainNetwork;
      payloadType: 'TRANSACTION' | 'MESSAGE' | 'TYPED_DATA';
      payload: string;
      feeEstimate?: string;
    },
  ) {
    if (input.kind === 'READONLY') throw new ConnectionsSigningNotAllowedError();
    // Ownership (defense-in-depth IDOR): the supplied connectionRef must resolve to
    // an ACTIVE, signable connection owned by the authenticated user. The DB query
    // is scoped by both userId and externalRef (never a global lookup checked late),
    // so a manually-supplied connectionRef belonging to another user — or a
    // revoked/disconnected connection — is rejected without leaking its existence.
    const connection = await this.prisma.externalWalletConnection.findFirst({
      where: {
        userId,
        externalRef: input.connectionRef,
        kind: input.kind,
        status: 'CONNECTED',
      },
      select: { id: true, canSign: true },
    });
    if (!connection || !connection.canSign) {
      throw new ConnectionsNotFoundError('Active signable connection not found');
    }
    const started = Date.now();
    const prepared = await this.providers.prepareSign(input);
    if (!prepared.simulationOk) {
      throw new ConnectionsValidationError('Sign simulation failed');
    }
    const request = await this.prisma.externalSigningRequest.create({
      data: {
        id: this.ids.uuid(),
        userId,
        kind: input.kind,
        connectionRef: input.connectionRef,
        network: input.network,
        payloadType: input.payloadType,
        payloadHash: prepared.dataHash,
        preview: prepared.preview,
        feeEstimate: prepared.feeEstimate,
        providerRequestId: prepared.requestId,
        status: 'PENDING_CONFIRMATION',
        requiresConfirmation: true,
        metadata: prepared as unknown as Prisma.InputJsonValue,
      },
    });
    void this.analytics.publishEvent({
      eventType: CONNECTIONS_EVENTS.SIGN_PREPARED,
      aggregateId: request.id,
      payload: { userId, latencyMs: Date.now() - started, kind: input.kind },
    });
    this.emitAdminEvent({
      type: 'SIGN_REQUEST_CREATED',
      userId,
      targetId: request.id,
      metadata: {
        network: String(input.network),
        payloadType: input.payloadType,
        kind: String(input.kind),
        status: 'PENDING_CONFIRMATION',
      },
    });
    return { requestId: request.id, prepared, requiresConfirmation: true };
  }

  async confirmSign(userId: string, requestId: string, confirmed: boolean) {
    const request = await this.prisma.externalSigningRequest.findFirst({
      where: { id: requestId, userId },
    });
    if (!request) throw new ConnectionsNotFoundError('Sign request not found');
    // Status gating enforces single-use: only a PENDING_CONFIRMATION request may be
    // confirmed. Anything already COMPLETED/FAILED/REJECTED/EXPIRED/CANCELLED cannot
    // be replayed.
    if (request.status !== 'PENDING_CONFIRMATION' || !request.providerRequestId) {
      throw new ConnectionsValidationError('Request is not awaiting confirmation');
    }
    // Expiry enforcement (CONNECTIONS_SIGN_TIMEOUT_SECONDS): computed from the DB
    // creation timestamp so it is deterministic and not client-controllable. An
    // expired request is moved to the terminal EXPIRED state and can NEVER reach the
    // provider or transition to COMPLETED — this both enforces the timeout and blocks
    // replay after expiry.
    const expiresAt =
      request.createdAt.getTime() + this.env.CONNECTIONS_SIGN_TIMEOUT_SECONDS * 1000;
    if (this.clock.now().getTime() >= expiresAt) {
      await this.prisma.externalSigningRequest.update({
        where: { id: request.id },
        data: {
          status: 'EXPIRED',
          errorMessage: 'Sign request expired before confirmation',
          completedAt: this.clock.now(),
        },
      });
      void this.analytics.publishEvent({
        eventType: CONNECTIONS_EVENTS.SIGN_FAILED,
        aggregateId: request.id,
        payload: { userId, expired: true },
      });
      this.emitAdminEvent({
        type: 'SIGN_REQUEST_FAILED',
        userId,
        targetId: request.id,
        severity: 'warning',
        metadata: { reason: 'expired', network: String(request.network) },
      });
      throw new ConnectionsValidationError('Sign request expired');
    }
    const started = Date.now();
    const result = await this.providers.completeSign(request.providerRequestId, confirmed);
    if (!confirmed || result.status === 'REJECTED') {
      await this.prisma.externalSigningRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          errorMessage: result.errorMessage ?? 'User rejected',
          confirmedAt: this.clock.now(),
          completedAt: this.clock.now(),
        },
      });
      void this.analytics.publishEvent({
        eventType: CONNECTIONS_EVENTS.SIGN_FAILED,
        aggregateId: request.id,
        payload: { userId, latencyMs: Date.now() - started, rejected: true },
      });
      this.emitAdminEvent({
        type: 'SIGN_REQUEST_FAILED',
        userId,
        targetId: request.id,
        severity: 'warning',
        metadata: { reason: 'rejected', network: String(request.network) },
      });
      return {
        requestId,
        status: 'REJECTED',
        errorMessage: result.errorMessage ?? 'User rejected',
      };
    }
    const verified = Boolean(result.verified && result.signature);
    await this.prisma.externalSigningRequest.update({
      where: { id: request.id },
      data: {
        status: result.status === 'COMPLETED' && verified ? 'COMPLETED' : 'FAILED',
        signature: result.signature ? this.crypto.encrypt(result.signature) : null,
        txHash: result.txHash,
        errorMessage: result.errorMessage,
        confirmedAt: this.clock.now(),
        completedAt: this.clock.now(),
      },
    });
    if (result.status !== 'COMPLETED' || !verified) {
      await this.prisma.connectionRetryJob.create({
        data: {
          id: this.ids.uuid(),
          jobType: 'SIGN_RETRY',
          status: 'PENDING',
          payload: { requestId } as Prisma.InputJsonValue,
          errorMessage: result.errorMessage ?? 'sign failed',
        },
      });
      void this.analytics.publishEvent({
        eventType: CONNECTIONS_EVENTS.SIGN_FAILED,
        aggregateId: request.id,
        payload: { userId, latencyMs: Date.now() - started },
      });
      this.emitAdminEvent({
        type: 'SIGN_REQUEST_FAILED',
        userId,
        targetId: request.id,
        severity: 'warning',
        metadata: { reason: 'sign_failed', network: String(request.network) },
      });
      return { requestId, status: 'FAILED', errorMessage: result.errorMessage };
    }
    void this.notifications.publishEvent({
      eventType: CONNECTIONS_EVENTS.SIGN_COMPLETED,
      aggregateId: request.id,
      payload: { userId, title: 'Signature completed', body: request.payloadType },
    });
    void this.ai.publish(CONNECTIONS_EVENTS.SIGN_COMPLETED, { userId, requestId });
    void this.analytics.publishEvent({
      eventType: CONNECTIONS_EVENTS.SIGN_COMPLETED,
      aggregateId: request.id,
      payload: { userId, latencyMs: Date.now() - started, verified },
    });
    this.emitAdminEvent({
      type: 'SIGN_REQUEST_COMPLETED',
      userId,
      targetId: request.id,
      metadata: {
        network: String(request.network),
        // txHash is public chain data — never signature/private material.
        txHash: result.txHash ?? null,
        verified,
      },
    });
    return {
      requestId,
      status: 'COMPLETED',
      signaturePresent: true,
      txHash: result.txHash,
      verified,
    };
  }

  async listConnections(userId: string) {
    return this.prisma.externalWalletConnection.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listSigningRequests(userId: string) {
    return this.prisma.externalSigningRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
