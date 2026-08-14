import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { HoldingInput } from '../../application/services/portfolio-intelligence.service';

/**
 * Validated portfolio holding input. `assetChain` is intentionally a bounded
 * string (not restricted to priced market networks) so multi-chain holdings are
 * accepted; unpriced chains are simply valued at zero downstream.
 */
export class HoldingDto implements HoldingInput {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  walletId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  assetCode!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  assetSymbol!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  assetChain!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  quantity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  costBasisUsd?: string | null;
}

/** Maximum holdings accepted in a single portfolio request. */
export const MAX_HOLDINGS = 500;
/** Maximum symbols/items accepted in a single batch quote request. */
export const MAX_BATCH_ITEMS = 100;
