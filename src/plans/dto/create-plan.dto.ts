import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @ApiProperty({ example: 'Basic' })
  @IsString()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 99 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceMonthly!: number;

  @ApiProperty({ example: 990 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceYearly!: number;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxNormalUsers!: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAgencyManagers!: number;

  @ApiProperty({ example: 100, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxTicketsPerMonth?: number;

  @ApiProperty({ example: 50, required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  maxInvoicesPerMonth?: number;

  @ApiProperty({ example: { api_access: true, support_247: false }, required: false })
  @IsOptional()
  features?: any;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}