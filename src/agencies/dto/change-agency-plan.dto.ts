import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ChangeAgencyPlanDto {
  @ApiProperty({ example: 'plan-uuid', description: 'شناسه پلن جدید' })
  @IsString()
  @IsUUID()
  planId!: string;

  @ApiProperty({ required: false, description: 'تاریخ شروع (پیش‌فرض: الان)' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ required: false, description: 'تاریخ پایان (اختیاری)' })
  @IsDateString()
  @IsOptional()
  endDate?: string;
}