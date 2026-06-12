import { PartialType } from '@nestjs/swagger';
import { CreateTicketDto } from './create-ticket.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TicketStatus } from '@prisma/client';

export class UpdateTicketDto extends PartialType(CreateTicketDto) {
  @ApiProperty({ enum: TicketStatus, required: false, description: 'وضعیت بلیط' })
  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;
}