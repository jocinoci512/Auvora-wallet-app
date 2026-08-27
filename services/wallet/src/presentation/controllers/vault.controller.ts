import { Body, Controller, Get, Inject, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims } from '@auvora/types';
import { successResponse } from '@auvora/nest-common';
import { assertNoPlaintextSecrets } from '@auvora/vault-crypto';
import { EncryptedVaultService } from '../../application/services/encrypted-vault.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';

class UpsertVaultDto {
  @IsString()
  @MinLength(4)
  algorithmId!: string;

  @IsInt()
  @Min(1)
  version!: number;

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

@ApiTags('vault')
@Controller('api/v1/vault')
export class VaultController {
  constructor(@Inject(EncryptedVaultService) private readonly vault: EncryptedVaultService) {}

  @Get()
  async getVault(@CurrentUser() user: JwtAccessClaims) {
    const data = await this.vault.getForOwner(user.sub);
    return successResponse(data);
  }

  @Put()
  async upsertVault(@CurrentUser() user: JwtAccessClaims, @Body() dto: UpsertVaultDto) {
    // Reject mnemonic-like plaintext or forbidden secret field names before persistence.
    // EncryptedVaultService also asserts; this is a belt-and-suspenders controller gate.
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
}
