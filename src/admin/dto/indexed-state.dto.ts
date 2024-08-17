import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class IndexedStateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  network: string;

  @ApiProperty()
  @IsOptional()
  blockNumber?: number;

  @ApiProperty()
  @IsOptional()
  contractAddress?: string;
}
