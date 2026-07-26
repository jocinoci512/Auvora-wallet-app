import { IsEnum } from 'class-validator';
import { ChainNetwork, FeePriority } from '@auvora/database';

export class EstimateFeeDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  @IsEnum(FeePriority)
  priority!: FeePriority;
}
