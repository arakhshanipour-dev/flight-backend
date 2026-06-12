import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsUUID, MaxLength, MinLength } from 'class-validator';
import { SupportTicketPriority } from '@prisma/client';

export class CreateSupportTicketDto {
  @ApiProperty({ example: 'مشکل در ورود به سیستم', description: 'عنوان تیکت' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 'از دیروز نمی‌توانم وارد پنل شوم. خطای ۵۰۰ می‌دهد.', description: 'توضیحات مشکل' })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: SupportTicketPriority, default: SupportTicketPriority.MEDIUM, required: false })
  @IsEnum(SupportTicketPriority)
  @IsOptional()
  priority?: SupportTicketPriority;

  @ApiProperty({ required: false, description: 'شناسه تیکت والد (برای Forward کردن)' })
  @IsUUID()
  @IsOptional()
  parentTicketId?: string;
}