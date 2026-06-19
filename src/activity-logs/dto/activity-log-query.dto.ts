// activity-log-query.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ActivityLogQueryDto {
  @ApiProperty({ required: false, description: 'شناسه کاربر' })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ required: false, description: 'شناسه آژانس' })
  @IsUUID()
  @IsOptional()
  agencyId?: string;

  @ApiProperty({ required: false, description: 'شناسه سازمان' })
  @IsUUID()
  @IsOptional()
  organizationId?: string;

  @ApiProperty({ required: false, description: 'نوع موجودیت' })
  @IsString() // ✅ تغییر از enum به string
  @IsOptional()
  entityType?: string;

  @ApiProperty({ required: false, description: 'شناسه موجودیت' })
  @IsUUID()
  @IsOptional()
  entityId?: string;

  @ApiProperty({ required: false, description: 'عملیات انجام شده' })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiProperty({ required: false, description: 'تاریخ شروع (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false, description: 'تاریخ پایان (YYYY-MM-DD)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, default: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @ApiProperty({ required: false, description: 'جستجو در action, entityType' })
  @IsString()
  @IsOptional()
  search?: string;
}