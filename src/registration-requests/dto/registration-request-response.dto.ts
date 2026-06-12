import { ApiProperty } from '@nestjs/swagger';
import { RegistrationRequestStatus } from '@prisma/client';

export class RegistrationRequestResponseDto {
  @ApiProperty()
  id!: string;                    // ← Added !

  @ApiProperty()
  agencyName!: string;            // ← Added !

  @ApiProperty({ nullable: true })
  registrationNumber: string | null = null;

  @ApiProperty()
  contactName!: string;           // ← Added !

  @ApiProperty()
  contactPhone!: string;          // ← Added !

  @ApiProperty()
  contactEmail!: string;          // ← Added !

  @ApiProperty({ nullable: true })
  message: string | null = null;

  @ApiProperty({ enum: RegistrationRequestStatus })
  status!: RegistrationRequestStatus;   // ← Added !

  @ApiProperty({ nullable: true })
  reviewedBy: string | null = null;

  @ApiProperty({ nullable: true })
  reviewedAt: Date | null = null;

  @ApiProperty({ nullable: true })
  notes: string | null = null;

  @ApiProperty({ nullable: true })
  agencyId: string | null = null;

  @ApiProperty()
  createdAt!: Date;               // ← Added !

  @ApiProperty()
  updatedAt!: Date;               // ← Added !
}