import { IsString, IsIn, IsOptional } from 'class-validator';
import { CronExpression } from '@nestjs/schedule';
import { ApiProperty } from '@nestjs/swagger';

export class StartCronDto {
  @ApiProperty()
  @IsOptional()
  @IsString()
  @IsIn(Object.values(CronExpression))
  timePeriod: string;
}
