import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { successResponse } from '@auvora/nest-common';
import { assertNoPlaintextSecrets } from '@auvora/vault-crypto';
import { hashToken } from '@auvora/security';
import { PrismaService } from '@auvora/database';
import { EncryptedVaultService } from '../../application/services/encrypted-vault.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { UnauthorizedError, ValidationError } from '../../domain';
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

/**
 * Canonical auvora-vault-v1 wire envelope (camelCase JSON).
 * Do not send password/mnemonic. See packages/vault-crypto/WIRE_CONTRACT.md.
 * `deviceId` must be devices.id UUID — never a fingerprint (`and-…`).
 */
class UpsertVaultDto {
  @IsString()
  @MinLength(4)
  algorithmId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  /** First upload >= 1; updates must strictly increase. */
  @IsInt()
  @Min(1)
  epoch!: number;

  @IsString()
  @MinLength(8)
  kdfSalt!: string;

  @IsObject()
  kdfParams!: Record<string, unknown>;

  @IsString()
  @MinLength(8)
  recoveryKdfSalt!: string;

  @IsObject()
  recoveryKdfParams!: Record<string, unknown>;

  @IsString()
  @MinLength(8)
  wrappedVaultKey!: string;

  @IsString()
  @MinLength(8)
  wrappedVaultKeyRecovery!: string;

  @IsString()
  @MinLength(8)
  ciphertext!: string;

  @IsString()
  @MinLength(8)
  aad!: string;

  @IsOptional()
  @IsUUID()
  deviceId?: string;
}

class RecoveryUpsertVaultDto extends UpsertVaultDto {
  @IsString()
  @MinLength(20)
  resetToken!: string;

  @IsUUID()
  requestId!: string;
}

@ApiTags('vault')
@Controller('api/v1/vault')
export class VaultController {
  constructor(
    @Inject(EncryptedVaultService) private readonly vault: EncryptedVaultService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  @Get()
  async getVault(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.vault.getForOwner(user.sub);
    return successResponse(data);
  }

  @Put()
  async upsertVault(@CurrentUser() user: JwtAccessClaims, @Body() dto: UpsertVaultDto) {
    assertNoPlaintextSecrets(dto as unknown as Record<string, unknown>);

    const data = await this.vault.upsertForOwner({
      ownerUserId: user.sub,
      deviceId: dto.deviceId,
      algorithmId: dto.algorithmId,
      version: dto.version,
      epoch: dto.epoch,
      kdfSalt: dto.kdfSalt,
      kdfParams: dto.kdfParams,
      recoveryKdfSalt: dto.recoveryKdfSalt,
      recoveryKdfParams: dto.recoveryKdfParams,
      wrappedVaultKey: dto.wrappedVaultKey,
      wrappedVaultKeyRecovery: dto.wrappedVaultKeyRecovery,
      ciphertext: dto.ciphertext,
      aad: dto.aad,
    });
    return successResponse(data);
  }

  /**
   * Vault re-protect during trusted-device recovery (before password rotate).
   * Authorized by password-reset token + recovery request — not a customer bypass.
   */
  @Public()
  @SkipCsrf()
  @Put('recovery')
  async upsertVaultForRecovery(@Body() dto: RecoveryUpsertVaultDto) {
    assertNoPlaintextSecrets(dto as unknown as Record<string, unknown>);
    const tokenHash = hashToken(dto.resetToken);
    const row = await this.prisma.vaultDeviceRecoveryRequest.findFirst({
      where: { id: dto.requestId },
    });
    if (!row || row.ownershipTokenHash !== tokenHash) {
      throw new UnauthorizedError('Invalid recovery authorization');
    }
    if (row.status !== 'CONSUMED' && row.status !== 'APPROVED') {
      throw new ValidationError('Recovery request is not ready for vault upload');
    }
    const data = await this.vault.upsertForOwner({
      ownerUserId: row.ownerUserId,
      deviceId: dto.deviceId,
      algorithmId: dto.algorithmId,
      version: dto.version,
      epoch: dto.epoch,
      kdfSalt: dto.kdfSalt,
      kdfParams: dto.kdfParams,
      recoveryKdfSalt: dto.recoveryKdfSalt,
      recoveryKdfParams: dto.recoveryKdfParams,
      wrappedVaultKey: dto.wrappedVaultKey,
      wrappedVaultKeyRecovery: dto.wrappedVaultKeyRecovery,
      ciphertext: dto.ciphertext,
      aad: dto.aad,
    });
    return successResponse(data);
  }
}
