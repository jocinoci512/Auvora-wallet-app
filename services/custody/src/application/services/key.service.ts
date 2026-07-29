import { Inject, Injectable } from '@nestjs/common';
import {
  PrismaService,
  type KeyAlgorithm,
  type CustodyModel,
  type KeyStatus,
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
  type CustodyProviderRegistryPort,
} from '../../domain';
import { CUSTODY_PROVIDER_REGISTRY } from '../ports/provider.tokens';

export interface GenerateKeyInput {
  algorithm: KeyAlgorithm;
  custodyModel: CustodyModel;
  walletId?: string;
  label?: string;
}

type CryptographicKeyRecord = Prisma.CryptographicKeyGetPayload<Record<string, never>>;

export type SanitizedKey = Omit<CryptographicKeyRecord, 'materialEncrypted'>;

function sanitize(key: CryptographicKeyRecord): SanitizedKey {
  const { materialEncrypted: _materialEncrypted, ...rest } = key;
  void _materialEncrypted;
  return rest;
}

@Injectable()
export class KeyService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CUSTODY_PROVIDER_REGISTRY) private readonly providers: CustodyProviderRegistryPort,
    @Inject(EVENT_BUS) private readonly events: EventBusPort,
  ) {}

  async generate(ownerUserId: string, input: GenerateKeyInput): Promise<SanitizedKey> {
    const provider = this.providers.resolve(input.custodyModel);
    const generated = await provider.generateKey({
      ownerUserId,
      algorithm: input.algorithm,
      custodyModel: input.custodyModel,
      label: input.label,
    });

    const providerRecord = await this.prisma.custodyProviderRecord.findFirst({
      where: { code: generated.providerCode },
    });

    const key = await this.prisma.cryptographicKey.create({
      data: {
        ownerUserId,
        walletId: input.walletId,
        providerId: providerRecord?.id,
        label: input.label,
        algorithm: input.algorithm,
        custodyModel: input.custodyModel,
        status: 'ACTIVE',
        publicKey: generated.publicKey,
        materialEncrypted: generated.materialEncrypted,
        providerRef: generated.providerRef,
        currentVersion: 1,
      },
    });

    await this.prisma.keyVersion.create({
      data: {
        keyId: key.id,
        version: 1,
        publicKey: generated.publicKey,
        materialEncrypted: generated.materialEncrypted,
        providerRef: generated.providerRef,
      },
    });

    await this.audit(key.id, ownerUserId, 'KEY_GENERATED', {
      algorithm: input.algorithm,
      custodyModel: input.custodyModel,
    });
    await this.events.publish({
      type: CustodyEventType.KeyGenerated,
      aggregateId: key.id,
      payload: { ownerUserId, algorithm: input.algorithm, custodyModel: input.custodyModel },
    });

    return sanitize(key);
  }

  async list(filters: {
    ownerUserId?: string;
    status?: KeyStatus;
    skip?: number;
    take?: number;
  }): Promise<{
    items: SanitizedKey[];
    total: number;
    skip: number;
    take: number;
  }> {
    const skip = filters.skip ?? 0;
    const take = Math.min(filters.take ?? 50, 100);
    const where: Prisma.CryptographicKeyWhereInput = {
      ...(filters.ownerUserId ? { ownerUserId: filters.ownerUserId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.cryptographicKey.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.cryptographicKey.count({ where }),
    ]);
    return { items: items.map(sanitize), total, skip, take };
  }

  async get(id: string, requester?: JwtAccessClaims): Promise<SanitizedKey> {
    const key = await this.getOrThrow(id);
    if (requester) {
      this.assertSelfOrAdmin(key.ownerUserId, requester);
    }
    return sanitize(key);
  }

  async rotate(id: string, actor: JwtAccessClaims): Promise<SanitizedKey> {
    const key = await this.getOrThrow(id);
    this.assertSelfOrAdmin(key.ownerUserId, actor);
    if (key.status !== 'ACTIVE') {
      throw new ConflictError(`Cannot rotate a key in status ${key.status}`);
    }

    const provider = this.providers.resolve(key.custodyModel);
    const rotated = await provider.rotate({
      keyId: key.id,
      algorithm: key.algorithm,
      custodyModel: key.custodyModel,
      previousProviderRef: key.providerRef ?? undefined,
    });

    const nextVersion = key.currentVersion + 1;
    await this.prisma.keyVersion.create({
      data: {
        keyId: key.id,
        version: nextVersion,
        publicKey: rotated.publicKey,
        materialEncrypted: rotated.materialEncrypted,
        providerRef: rotated.providerRef,
        rotatedFromVersion: key.currentVersion,
      },
    });

    const updated = await this.prisma.cryptographicKey.update({
      where: { id: key.id },
      data: {
        publicKey: rotated.publicKey,
        materialEncrypted: rotated.materialEncrypted,
        providerRef: rotated.providerRef,
        currentVersion: nextVersion,
      },
    });

    await this.audit(key.id, actor.sub, 'KEY_ROTATED', {
      fromVersion: key.currentVersion,
      toVersion: nextVersion,
    });
    await this.events.publish({
      type: CustodyEventType.KeyRotated,
      aggregateId: key.id,
      payload: { ownerUserId: key.ownerUserId, version: nextVersion },
    });

    return sanitize(updated);
  }

  async revoke(id: string, actor: JwtAccessClaims, reason?: string): Promise<SanitizedKey> {
    this.assertAdmin(actor);
    const key = await this.getOrThrow(id);
    if (key.status === 'REVOKED' || key.status === 'DESTROYED') {
      throw new ConflictError(`Key already ${key.status.toLowerCase()}`);
    }
    const updated = await this.prisma.cryptographicKey.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await this.audit(id, actor.sub, 'KEY_REVOKED', { reason });
    await this.events.publish({
      type: CustodyEventType.KeyRevoked,
      aggregateId: id,
      payload: { ownerUserId: key.ownerUserId, reason },
    });
    return sanitize(updated);
  }

  async destroy(id: string, actor: JwtAccessClaims): Promise<SanitizedKey> {
    this.assertAdmin(actor);
    const key = await this.getOrThrow(id);
    if (key.status === 'DESTROYED') {
      throw new ConflictError('Key already destroyed');
    }
    const provider = this.providers.resolve(key.custodyModel);
    await provider.destroy({
      keyId: key.id,
      providerRef: key.providerRef ?? undefined,
      materialEncrypted: key.materialEncrypted ?? undefined,
    });

    const updated = await this.prisma.cryptographicKey.update({
      where: { id },
      data: { status: 'DESTROYED', destroyedAt: new Date(), materialEncrypted: null },
    });
    await this.audit(id, actor.sub, 'KEY_DESTROYED', {});
    await this.events.publish({
      type: CustodyEventType.KeyDestroyed,
      aggregateId: id,
      payload: { ownerUserId: key.ownerUserId },
    });
    return sanitize(updated);
  }

  async auditTrail(id: string, take = 50) {
    await this.getOrThrow(id);
    return this.prisma.keyAuditLog.findMany({
      where: { keyId: id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }

  async securityActivity(ownerUserId: string, take = 50) {
    return this.prisma.keyAuditLog.findMany({
      where: { OR: [{ actorUserId: ownerUserId }, { key: { ownerUserId } }] },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }

  private async getOrThrow(id: string): Promise<CryptographicKeyRecord> {
    const key = await this.prisma.cryptographicKey.findUnique({ where: { id } });
    if (!key) throw new NotFoundError('Cryptographic key not found');
    return key;
  }

  private async audit(
    keyId: string,
    actorUserId: string,
    action: string,
    details: Record<string, unknown>,
  ) {
    await this.prisma.keyAuditLog.create({
      data: { keyId, actorUserId, action, details: details as Prisma.InputJsonValue },
    });
  }

  private assertSelfOrAdmin(ownerUserId: string, requester: JwtAccessClaims) {
    if (
      ownerUserId !== requester.sub &&
      !requester.permissions.includes(PERMISSION_CUSTODY_ADMIN)
    ) {
      throw new ForbiddenError('Access denied');
    }
  }

  private assertAdmin(requester: JwtAccessClaims) {
    if (!requester.permissions.includes(PERMISSION_CUSTODY_ADMIN)) {
      throw new ForbiddenError('Custody admin permission required');
    }
  }
}
