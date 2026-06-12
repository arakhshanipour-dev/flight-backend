import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MaxLength, MinLength } from 'class-validator';

export class ReplyToTicketDto {
  @ApiProperty({ example: 'مشکل را بررسی می‌کنم. لطفاً صبور باشید.', description: 'متن پاسخ' })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  @ApiProperty({ default: false, required: false, description: 'آیا پاسخ فقط برای تیم پشتیبانی قابل مشاهده باشد؟' })
  @IsBoolean()
  @IsOptional()
  isInternal?: boolean;
}