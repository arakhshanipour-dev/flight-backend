import { ApiProperty } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@prisma/client';

export class AgencyUserResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty({ nullable: true })
  lastLoginAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ required: false, type: Number })
  penaltyPoints?: number;
}