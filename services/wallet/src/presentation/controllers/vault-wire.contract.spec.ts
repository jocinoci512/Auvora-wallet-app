import { ValidationPipe } from '@nestjs/common';
import { VAULT_ALGORITHM_ID } from '@auvora/vault-crypto';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  validate,
} from 'class-validator';

/**
 * Mirror of VaultController UpsertVaultDto for pure contract tests
 * (avoids Nest HTTP bootstrap cost under memory pressure).
 */
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

const owner = '11111111-1111-4111-8111-111111111111';

function androidShapedBody(overrides: Record<string, unknown> = {}) {
  return Object.assign(new UpsertVaultDto(), {
    algorithmId: VAULT_ALGORITHM_ID,
    version: 1,
    epoch: 1,
    kdfSalt: 'YWJjZGVmZ2hpamtsbW5vcA==',
    kdfParams: { type: 'argon2id', memoryCost: 65536, timeCost: 3, parallelism: 1, hashLength: 32 },
    recoveryKdfSalt: 'cXdlcnR5dWlvcGFzZGZnaA==',
    recoveryKdfParams: {
      type: 'argon2id',
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
      hashLength: 32,
    },
    wrappedVaultKey: 'd3JhcC1wYXNzd29yZC1rZXktYWFhYWFhYQ==',
    wrappedVaultKeyRecovery: 'd3JhcC1yZWNvdmVyeS1rZXktYmJiYmJiYg==',
    ciphertext: 'Y2lwaGVydGV4dC1lbmNyeXB0ZWQtYm9keQ==',
    aad: `${VAULT_ALGORITHM_ID}|${owner}|1`,
    ...overrides,
  });
}

describe('auvora-vault-v1 wire DTO contract', () => {
  it('accepts Android-shaped envelope without deviceId (first upload epoch 1)', async () => {
    const errors = await validate(androidShapedBody());
    expect(errors).toHaveLength(0);
  });

  it('accepts Web-shaped envelope with UUID deviceId', async () => {
    const errors = await validate(
      androidShapedBody({ deviceId: '80e86fc3-de9e-4114-b9ff-e4ac5433a55f' }),
    );
    expect(errors).toHaveLength(0);
  });

  it('rejects Android fingerprint deviceId and-<uuid>', async () => {
    const errors = await validate(
      androidShapedBody({ deviceId: 'and-97cf116b-c6b4-4691-8746-e006096339b2' }),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'deviceId')).toBe(true);
  });

  it('rejects password field via ValidationPipe forbidNonWhitelisted', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        {
          ...androidShapedBody(),
          password: 'should-never-be-accepted',
        },
        { type: 'body', metatype: UpsertVaultDto },
      ),
    ).rejects.toBeTruthy();
  });
});
