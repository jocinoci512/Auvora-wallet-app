import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;

export class AdminReasonDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(500)
  reason!: string;
}

export class UserIdParamDto {
  @IsUUID()
  userId!: string;
}

export class ReviewIdParamDto {
  @IsUUID()
  reviewId!: string;
}

export class AssetCodeParamDto {
  @IsString()
  @IsNotEmpty()
  assetCode!: string;
}

export class UpsertSimulationBalanceDto extends AdminReasonDto {
  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsIn(['set', 'increase', 'decrease'])
  operation!: 'set' | 'increase' | 'decrease';

  @IsString()
  @IsNotEmpty()
  amount!: string;
}

export class SimulationPresetParamDto {
  @IsString()
  @IsNotEmpty()
  presetCode!: string;
}

export class CreateSimulationTransactionDto extends AdminReasonDto {
  @IsString()
  @IsNotEmpty()
  assetCode!: string;

  @IsIn([
    'incoming_transfer',
    'outgoing_success',
    'insufficient_balance',
    'pending_transaction',
    'failed_transaction',
    'rejected_transaction',
    'large_transfer_review',
    'security_hold',
  ])
  scenario!:
    | 'incoming_transfer'
    | 'outgoing_success'
    | 'insufficient_balance'
    | 'pending_transaction'
    | 'failed_transaction'
    | 'rejected_transaction'
    | 'large_transfer_review'
    | 'security_hold';

  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  destinationAddress?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class AdminListReviewsQueryDto {
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: (typeof REVIEW_STATUSES)[number];

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;
}

export class ReviewDecisionDto extends AdminReasonDto {}
