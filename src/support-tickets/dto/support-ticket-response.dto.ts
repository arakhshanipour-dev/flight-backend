import { ApiProperty } from '@nestjs/swagger';
import { SupportTicketStatus, SupportTicketPriority } from '@prisma/client';

class TicketReplyUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  role!: string;
}

class TicketReplyDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty()
  isInternal!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: TicketReplyUserDto })
  user!: TicketReplyUserDto;
}

class SupportTicketUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  role!: string;
}

export class SupportTicketResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticketNumber!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: SupportTicketStatus })
  status!: SupportTicketStatus;

  @ApiProperty({ enum: SupportTicketPriority })
  priority!: SupportTicketPriority;

  @ApiProperty()
  senderType!: string;

  @ApiProperty({ nullable: true })
  agencyId!: string | null;

  @ApiProperty({ nullable: true })
  organizationId!: string | null;

  @ApiProperty({ nullable: true, required: false })
  agencyName?: string | null;

  @ApiProperty({ nullable: true, required: false })
  organizationName?: string | null;

  @ApiProperty({ nullable: true })
  forwardedTo!: string | null;

  @ApiProperty({ nullable: true })
  parentTicketId!: string | null;

  @ApiProperty({ nullable: true })
  resolvedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ type: SupportTicketUserDto })
  user!: SupportTicketUserDto;

  @ApiProperty({ type: [TicketReplyDto] })
  replies!: TicketReplyDto[];
}