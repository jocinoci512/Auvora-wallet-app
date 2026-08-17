import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;

  @ApiProperty({ description: 'Stable device fingerprint' })
  @IsString()
  @MinLength(8)
  deviceFingerprint!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  devicePlatform?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;
}

export class AdminMfaTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(16)
  mfaToken!: string;
}

export class AdminMfaCodeDto extends AdminMfaTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(16)
  code!: string;
}

export class AdminRecoveryDto extends AdminMfaTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(32)
  recoveryCode!: string;
}

export class AdminStepUpDto {
  @ApiProperty()
  @IsString()
  password!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  @MaxLength(16)
  code!: string;
}

export class AdminOperatorReasonDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}
