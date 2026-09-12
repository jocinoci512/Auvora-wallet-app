import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DeleteMyAccountDto {
  @ApiProperty({ description: 'Current account password for re-authentication' })
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @ApiProperty({
    description: 'Must be exactly DELETE (case-insensitive) to confirm intentional deletion',
    example: 'DELETE',
  })
  @IsString()
  @MinLength(6)
  confirmation!: string;
}
