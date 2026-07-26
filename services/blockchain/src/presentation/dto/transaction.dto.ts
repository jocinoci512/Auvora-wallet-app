import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ChainNetwork, ChainTxStatus } from '@auvora/database';
import { PaginationQueryDto } from './common.dto';

export class ListTransactionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChainNetwork)
  chain?: ChainNetwork;

  @IsOptional()
  @IsEnum(ChainTxStatus)
  status?: ChainTxStatus;
}

export class AdminListTransactionsQueryDto extends ListTransactionsQueryDto {
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}

export class TxIdOrHashParamDto {
  @IsString()
  @IsNotEmpty()
  idOrHash!: string;
}

export class FailTransactionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
