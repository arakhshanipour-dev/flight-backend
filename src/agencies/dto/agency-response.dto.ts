import { ApiProperty } from '@nestjs/swagger';
import { AgencyStatus } from '@prisma/client';

export class AgencyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  registrationNumber!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  address!: string | null;

  @ApiProperty({ enum: AgencyStatus })
  status!: AgencyStatus;

  @ApiProperty({ nullable: true })
  trialExpiresAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ 
    required: false, 
    type: () => ({
      users: { type: 'number' },
      bankCards: { type: 'number' },
      invoices: { type: 'number' },
      tickets: { type: 'number' },
    })
  })
  _count?: {
    users: number;
    bankCards: number;
    invoices: number;
    tickets: number;
  };
}