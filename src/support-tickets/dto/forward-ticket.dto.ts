import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, MaxLength } from 'class-validator';

export enum ForwardTarget {
  AGENCY_MANAGER = 'AGENCY_MANAGER',
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  SUPPORT = 'SUPPORT',
}

export class ForwardTicketDto {
  @ApiProperty({ enum: ForwardTarget, description: 'مرجعی که تیکت به آن ارسال می‌شود' })
  @IsEnum(ForwardTarget)
  forwardTo!: ForwardTarget;

  @ApiProperty({ required: false, description: 'توضیحات اضافی برای ارجاع' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}