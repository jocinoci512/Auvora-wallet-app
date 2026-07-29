import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type KeyAlgorithm,
  type SigningRequestType,
  type SigningRequestStatus,
  type Prisma,
} from '@auvora/database';
import type { JwtAccessClaims } from '@auvora/types';
import {
  ConflictError,
  CustodyEventType,
  EVENT_BUS,
  type EventBusPort,
  ForbiddenError,
  NotFoundError,
  PERMISSION_CUSTODY_ADMIN,
  requiredApprovalsForPolicy,
  type CustodyProviderRegistryPort,
  type PolicyContext,
} from '../../domain';
import {
  FIELD_ENCRYPTION,
  type FieldEncryptionPort,
} from '../../infrastructure/crypto/field-encryption.adapter';
import { AI_PUBLISHER, type AiPublisherPort } from '../../infrastructure/ai/ai-publisher.adapter';
import {
  ANALYTICS_PUBLISHER,
  type AnalyticsPublisherPort,
} from '../../infrastructure/analytics/analytics-publisher.adapter';
import {
  NOTIFICATIONS_PUBLISHER,
  type NotificationsPublisherPort,
} from '../../infrastructure/notifications/notifications-publisher.adapter';
import { CUSTODY_PROVIDER_REGISTRY } from '../ports/provider.tokens';
import { PolicyService } from './policy.service';

export interface CreateSigningRequestInput {
  keyId: string;
  requestType?: SigningRequestType;
  payload: string;
  amount?: string;
  asset?: string;
  destination?: string;
  metadata?: Record<string, unknown>;
}

const ACTIVE_QUEUE_STATUSES: SigningRequestStatus[] = [
  'QUEUED',
  'SCHEDULED',
  'AWAITING_APPROVAL',
  'APPROVED',
];

type CryptographicKeyRecord = Prisma.CryptographicKeyGetPayload<Record<string, never>>;

@Injectable()
export class SigningService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CUSTODY_PROVIDER_REGISTRY) private readonly providers: CustodyProviderRegistryPort,
    @Inject(FIELD_ENCRYPTION) private readonly crypto: FieldEncryptionPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
    @Inject(PolicyService) private readonly policies: PolicyService,
    @Inject(NOTIFICATIONS_PUBLISHER) private readonly notifications: NotificationsPublisherPort,
    @Inject(AI_PUBLISHER) private readonly ai: AiPublisherPort,
    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: AnalyticsPublisherPort,
  ) {}

  async createRequest(actor: JwtAccessClaims, input: CreateSigningRequestInput) {
    const key = await this.prisma.cryptographicKey.findUnique({ where: { id: input.keyId } });
    if (!key) throw new NotFoundError('Cryptographic key not found');
    this.assertSelfOrAdmin(key.ownerUserId, actor);
    if (key.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot sign with a key in status ${key.status}`);
    }
    return this.persistRequest(key, input, actor.roles[0]);
  }

  /** System-initiated signing (e.g. blockchain service withdrawal) — authorization is enforced upstream. */
  async createSystemRequest(input: CreateSigningRequestInput) {
    const key = await this.prisma.cryptographicKey.findUnique({ where: { id: input.keyId } });
    if (!key) throw new NotFoundError('Cryptographic key not found');
    if (key.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot sign with a key in status ${key.status}`);
    }
    return this.persistRequest(key, input, 'service');
  }

  async verifyRaw(input: {
    custodyModel: Parameters<CustodyProviderRegistryPort['resolve']>[0];
    algorithm: KeyAlgorithm;
    publicKey: string;
    payloadHash: string;
    signature: string;
  }) {
    const provider = this.providers.resolve(input.custodyModel);
    return provider.verify({
      publicKey: input.publicKey,
      algorithm: input.algorithm,
      payloadHash: input.payloadHash,
      signature: input.signature,
    });
  }

  private async persistRequest(
    key: CryptographicKeyRecord,
    input: CreateSigningRequestInput,
    userRole: string | undefined,
  ) {
    const payloadHash = this.crypto.hash(input.payload);
    const payloadEncrypted = this.crypto.encrypt(input.payload);

    const velocity = await this.prisma.signingRequest.count({
      where: {
        ownerUserId: key.ownerUserId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    const ctx: PolicyContext = {
      asset: input.asset,
      amount: Number(input.amount ?? 0),
      destination: input.destination,
      country:
        typeof input.metadata?.['country'] === 'string'
          ? (input.metadata['country'] as string)
          : undefined,
      riskScore:
        typeof input.metadata?.['riskScore'] === 'number'
          ? (input.metadata['riskScore'] as number)
          : 0,
      walletType:
        typeof input.metadata?.['walletType'] === 'string'
          ? (input.metadata['walletType'] as string)
          : undefined,
      userRole,
      time: new Date().getHours(),
      velocity,
      complianceResult:
        typeof input.metadata?.['complianceResult'] === 'string'
          ? (input.metadata['complianceResult'] as string)
          : undefined,
    };

    const decision = await this.policies.evaluateTransactionContext(ctx);

    if (decision.action === 'DENY') {
      await this.logViolations(decision.matched, undefined, key.ownerUserId);
      throw new ForbiddenError('Transaction denied by custody policy');
    }

    let requiredApprovals = 0;
    let approvalPolicyId: string | undefined;
    let status: SigningRequestStatus = 'QUEUED';
    let delayUntil: Date | undefined;

    if (decision.action === 'REQUIRE_APPROVAL') {
      const policy = await this.policies.findApplicableApprovalPolicy(ctx);
      requiredApprovals = policy
        ? requiredApprovalsForPolicy({ kind: policy.kind, threshold: policy.threshold })
        : 1;
      approvalPolicyId = policy?.id;
      status = 'AWAITING_APPROVAL';
    } else if (decision.action === 'DELAY') {
      const delayedPolicyCode = decision.matched.find((m) => m.action === 'DELAY')?.code;
      const delayedPolicy = delayedPolicyCode
        ? await this.prisma.transactionPolicy.findUnique({ where: { code: delayedPolicyCode } })
        : null;
      const meta = (delayedPolicy?.metadata ?? {}) as Record<string, unknown>;
      const delayMinutes = typeof meta['delayMinutes'] === 'number' ? meta['delayMinutes'] : 60;
      delayUntil = new Date(Date.now() + delayMinutes * 60 * 1000);
      status = 'SCHEDULED';
    }

    const created = await this.prisma.signingRequest.create({
      data: {
        keyId: key.id,
        ownerUserId: key.ownerUserId,
        requestType: input.requestType ?? 'TRANSACTION',
        status,
        payloadHash,
        payloadEncrypted,
        amount: input.amount,
        asset: input.asset,
        destination: input.destination,
        riskScore: ctx.riskScore ?? 0,
        approvalPolicyId,
        requiredApprovals,
        delayUntil,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    await this.logViolations(decision.matched, created.id, key.ownerUserId);

    await this.events.publish({
      type: CustodyEventType.SigningRequested,
      aggregateId: created.id,
      payload: { ownerUserId: key.ownerUserId, keyId: key.id, decision: decision.action },
    });

    return created;
  }

  async batchCreate(actor: JwtAccessClaims, items: CreateSigningRequestInput[]) {
    const batchId = randomUUID();
    const created = [];
    for (const item of items) {
      created.push(
        await this.createRequest(actor, {
          ...item,
          requestType: 'BATCH',
          metadata: { ...(item.metadata ?? {}), batchId },
        }),
      );
    }
    return { batchId, items: created };
  }

  async schedule(id: string, scheduledAt: Date, actor: JwtAccessClaims) {
    const request = await this.getOrThrow(id);
    this.assertSelfOrAdmin(request.ownerUserId, actor);
    if (request.status !== 'QUEUED' && request.status !== 'PENDING') {
      throw new ConflictError(`Cannot schedule a request in status ${request.status}`);
    }
    return this.prisma.signingRequest.update({
      where: { id },
      data: { status: 'SCHEDULED', scheduledAt },
    });
  }

  async delay(id: string, minutes: number, actor: JwtAccessClaims) {
    const request = await this.getOrThrow(id);
    this.assertSelfOrAdmin(request.ownerUserId, actor);
    return this.prisma.signingRequest.update({
      where: { id },
      data: { delayUntil: new Date(Date.now() + minutes * 60 * 1000) },
    });
  }

  async execute(id: string) {
    const request = await this.prisma.signingRequest.findUnique({
      where: { id },
      include: { key: true },
    });
    if (!request) throw new NotFoundError('Signing request not found');
    if (request.status === 'AWAITING_APPROVAL') {
      throw new ConflictError('Signing request is awaiting approval');
    }
    if (
      request.status !== 'QUEUED' &&
      request.status !== 'SCHEDULED' &&
      request.status !== 'APPROVED'
    ) {
      throw new ConflictError(`Cannot execute signing in status ${request.status}`);
    }
    if (request.scheduledAt && request.scheduledAt.getTime() > Date.now()) {
      throw new ConflictError('Scheduled time has not been reached');
    }
    if (request.delayUntil && request.delayUntil.getTime() > Date.now()) {
      throw new ConflictError('Delay window has not elapsed');
    }

    await this.prisma.signingRequest.update({ where: { id }, data: { status: 'SIGNING' } });
    const session = await this.prisma.signingSession.create({ data: { signingRequestId: id } });

    try {
      const provider = this.providers.resolve(request.key.custodyModel);
      const result = await provider.sign({
        keyId: request.key.id,
        publicKey: request.key.publicKey,
        materialEncrypted: request.key.materialEncrypted ?? undefined,
        providerRef: request.key.providerRef ?? undefined,
        algorithm: request.key.algorithm,
        payloadHash: request.payloadHash,
      });

      const updated = await this.prisma.signingRequest.update({
        where: { id },
        data: {
          status: 'SIGNED',
          signature: result.signature,
          signatureAlg: result.signatureAlg,
          completedAt: new Date(),
        },
      });

      await this.prisma.signingSession.update({
        where: { id: session.id },
        data: {
          finishedAt: new Date(),
          success: true,
          providerCode: result.providerCode,
          latencyMs: Date.now() - session.startedAt.getTime(),
        },
      });

      await this.events.publish({
        type: CustodyEventType.TransactionSigned,
        aggregateId: id,
        payload: { ownerUserId: request.ownerUserId, keyId: request.keyId },
      });
      await this.notifications.publishEvent({
        eventType: 'custody.signing.completed',
        aggregateId: id,
        payload: { ownerUserId: request.ownerUserId, keyId: request.keyId },
      });
      await this.ai.publishEvent({
        eventType: 'custody.signing.completed',
        aggregateId: id,
        payload: { ownerUserId: request.ownerUserId, keyId: request.keyId },
      });
      await this.analytics.publishEvent({
        eventType: 'custody.signing.completed',
        domain: 'CUSTODY',
        aggregateId: id,
        ownerUserId: request.ownerUserId,
        payload: { ownerUserId: request.ownerUserId, keyId: request.keyId },
      });

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.signingRequest.update({
        where: { id },
        data: { status: 'FAILED', failureReason: message },
      });
      await this.prisma.signingSession.update({
        where: { id: session.id },
        data: { finishedAt: new Date(), success: false, errorMessage: message },
      });
      throw error;
    }
  }

  async verifySignature(id: string) {
    const request = await this.prisma.signingRequest.findUnique({
      where: { id },
      include: { key: true },
    });
    if (!request) throw new NotFoundError('Signing request not found');
    if (!request.signature) {
      throw new ConflictError('Signing request has not been signed yet');
    }
    const provider = this.providers.resolve(request.key.custodyModel);
    return provider.verify({
      publicKey: request.key.publicKey,
      algorithm: request.key.algorithm,
      payloadHash: request.payloadHash,
      signature: request.signature,
    });
  }

  async history(
    ownerUserId: string,
    filters: { status?: SigningRequestStatus; skip?: number; take?: number } = {},
  ) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 100);
    const where: Prisma.SigningRequestWhereInput = {
      ownerUserId,
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.signingRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.signingRequest.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  async get(id: string) {
    return this.getOrThrow(id);
  }

  async listQueue(filters: { status?: SigningRequestStatus; skip?: number; take?: number } = {}) {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 100);
    const where: Prisma.SigningRequestWhereInput = filters.status
      ? { status: filters.status }
      : { status: { in: ACTIVE_QUEUE_STATUSES } };
    const [items, total] = await Promise.all([
      this.prisma.signingRequest.findMany({ where, orderBy: { createdAt: 'asc' }, skip, take }),
      this.prisma.signingRequest.count({ where }),
    ]);
    return { items, total, skip, take };
  }

  private async getOrThrow(id: string) {
    const request = await this.prisma.signingRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundError('Signing request not found');
    return request;
  }

  private async logViolations(
    matched: Array<{ code: string; action: string }>,
    signingRequestId: string | undefined,
    ownerUserId: string,
  ) {
    const violations = matched.filter((m) => m.action !== 'ALLOW');
    for (const violation of violations) {
      await this.prisma.custodyPolicyViolation.create({
        data: {
          policyCode: violation.code,
          ownerUserId,
          signingRequestId,
          action: violation.action as never,
        },
      });
      await this.events.publish({
        type: CustodyEventType.PolicyViolationDetected,
        aggregateId: signingRequestId,
        payload: { policyCode: violation.code, action: violation.action, ownerUserId },
      });
    }
  }

  private assertSelfOrAdmin(ownerUserId: string, requester: JwtAccessClaims) {
    if (
      ownerUserId !== requester.sub &&
      !requester.permissions.includes(PERMISSION_CUSTODY_ADMIN)
    ) {
      throw new ForbiddenError('Access denied');
    }
  }
}
