import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ChainNetwork, SyncJobStatus, SyncJobType } from '@auvora/database';
import { PaginationQueryDto } from './common.dto';

export class AdminListSyncJobsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChainNetwork)
  chain?: ChainNetwork;

  @IsOptional()
  @IsEnum(SyncJobStatus)
  status?: SyncJobStatus;

  @IsOptional()
  @IsEnum(SyncJobType)
  type?: SyncJobType;
}

export class AdminListBlocksQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChainNetwork)
  chain?: ChainNetwork;
}

export class AdminListHealthQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChainNetwork)
  chain?: ChainNetwork;
}

export class AdminListEventsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ChainNetwork)
  chain?: ChainNetwork;

  @IsOptional()
  @IsString()
  eventType?: string;
}

export class TriggerSyncDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;
}
