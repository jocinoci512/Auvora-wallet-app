import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, PrismaService } from '@auvora/database';
import { assertNoPlaintextSecrets, VAULT_ALGORITHM_ID } from '@auvora/vault-crypto';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain';

export type VaultBlobDto = {
  algorithmId: string;
  version: number;
  epoch: number;
  kdfSalt: string;
  kdfParams: unknown;
  recoveryKdfSalt: string;
  recoveryKdfParams: unknown;
  wrappedVaultKey: string;
  wrappedVaultKeyRecovery: string;
  ciphertext: string;
  aad: string;
  updatedAt: string;
};

export type UpsertVaultInput = {
  ownerUserId: string;
  deviceId?: string;
  algorithmId: string;
  version: number;
  epoch: number;
  kdfSalt: string;
  kdfParams: unknown;
  recoveryKdfSalt: string;
  recoveryKdfParams: unknown;
  wrappedVaultKey: string;
  wrappedVaultKeyRecovery: string;
  ciphertext: string;
  aad: string;
};

@Injectable()
export class EncryptedVaultService {
  private readonly logger = new Logger(EncryptedVaultService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getForOwner(ownerUserId: string): Promise<VaultBlobDto | null> {
    const row = await this.prisma.encryptedVaultBlob.findUnique({
      where: { ownerUserId },
    });
    if (!row) return null;
    return this.toDto(row);
  }

  async upsertForOwner(input: UpsertVaultInput): Promise<VaultBlobDto> {
    this.validateEnvelope(input);
    assertNoPlaintextSecrets(input as unknown as Record<string, unknown>);

    const existing = await this.prisma.encryptedVaultBlob.findUnique({
      where: { ownerUserId: input.ownerUserId },
    });
    if (existing && input.epoch <= existing.epoch) {
      throw new ValidationError('Vault epoch must increase on update');
    }

    const row = await this.prisma.encryptedVaultBlob.upsert({
      where: { ownerUserId: input.ownerUserId },
      create: {
        ownerUserId: input.ownerUserId,
        algorithmId: input.algorithmId,
        version: input.version,
        epoch: input.epoch,
        kdfSalt: input.kdfSalt,
        kdfParams: input.kdfParams as Prisma.InputJsonValue,
        recoveryKdfSalt: input.recoveryKdfSalt,
        recoveryKdfParams: input.recoveryKdfParams as Prisma.InputJsonValue,
        wrappedVaultKey: input.wrappedVaultKey,
        wrappedVaultKeyRecovery: input.wrappedVaultKeyRecovery,
        ciphertext: input.ciphertext,
        aad: input.aad,
        uploadedByDeviceId: input.deviceId ?? null,
      },
      update: {
        algorithmId: input.algorithmId,
        version: input.version,
        epoch: input.epoch,
        kdfSalt: input.kdfSalt,
        kdfParams: input.kdfParams as Prisma.InputJsonValue,
        recoveryKdfSalt: input.recoveryKdfSalt,
        recoveryKdfParams: input.recoveryKdfParams as Prisma.InputJsonValue,
        wrappedVaultKey: input.wrappedVaultKey,
        wrappedVaultKeyRecovery: input.wrappedVaultKeyRecovery,
        ciphertext: input.ciphertext,
        aad: input.aad,
        uploadedByDeviceId: input.deviceId ?? null,
      },
    });

    await this.prisma.securityAuditLog.create({
      data: {
        action: 'VAULT_BLOB_UPSERTED' as never,
        actorUserId: input.ownerUserId,
        targetUserId: input.ownerUserId,
        metadata: {
          epoch: row.epoch,
          algorithmId: row.algorithmId,
          deviceId: input.deviceId ?? null,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Vault blob upserted for user ${input.ownerUserId} epoch ${row.epoch}`);
    return this.toDto(row);
  }

  assertOwnerAccess(requesterUserId: string, ownerUserId: string): void {
    if (requesterUserId !== ownerUserId) {
      throw new ForbiddenError('Vault access denied');
    }
  }

  private validateEnvelope(input: UpsertVaultInput): void {
    if (input.algorithmId !== VAULT_ALGORITHM_ID) {
      throw new ValidationError('Unsupported vault algorithm');
    }
    for (const field of [
      input.kdfSalt,
      input.recoveryKdfSalt,
      input.wrappedVaultKey,
      input.wrappedVaultKeyRecovery,
      input.ciphertext,
      input.aad,
    ]) {
      if (!field || field.length < 8) {
        throw new ValidationError('Invalid vault envelope field');
      }
    }
    if (!input.aad.includes(input.ownerUserId)) {
      throw new ValidationError('Vault AAD must bind owner user id');
    }
  }

  private toDto(row: {
    algorithmId: string;
    version: number;
    epoch: number;
    kdfSalt: string;
    kdfParams: unknown;
    recoveryKdfSalt: string;
    recoveryKdfParams: unknown;
    wrappedVaultKey: string;
    wrappedVaultKeyRecovery: string;
    ciphertext: string;
    aad: string;
    updatedAt: Date;
  }): VaultBlobDto {
    return {
      algorithmId: row.algorithmId,
      version: row.version,
      epoch: row.epoch,
      kdfSalt: row.kdfSalt,
      kdfParams: row.kdfParams,
      recoveryKdfSalt: row.recoveryKdfSalt,
      recoveryKdfParams: row.recoveryKdfParams,
      wrappedVaultKey: row.wrappedVaultKey,
      wrappedVaultKeyRecovery: row.wrappedVaultKeyRecovery,
      ciphertext: row.ciphertext,
      aad: row.aad,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async requireForOwner(ownerUserId: string): Promise<VaultBlobDto> {
    const blob = await this.getForOwner(ownerUserId);
    if (!blob) throw new NotFoundError('Encrypted vault not found');
    return blob;
  }
}
