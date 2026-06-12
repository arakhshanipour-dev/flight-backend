import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupportTicketStatus } from '@prisma/client';

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @ApiProperty({ required: false, description: 'توضیحات (مثلاً دلیل بستن تیکت)' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}