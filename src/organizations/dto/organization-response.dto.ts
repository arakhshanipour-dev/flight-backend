import { ApiProperty } from '@nestjs/swagger';

class OrganizationUserDto {
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
}

class OrganizationCountDto {
  @ApiProperty()
  invoices!: number;
}

export class OrganizationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  nationalId!: string | null;

  @ApiProperty({ nullable: true })
  phone!: string | null;

  @ApiProperty({ nullable: true })
  email!: string | null;

  @ApiProperty({ nullable: true })
  address!: string | null;

  @ApiProperty()
  hasPanel!: boolean;

  @ApiProperty({ nullable: true })
  panelCreatedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false, type: OrganizationUserDto })
  user?: OrganizationUserDto;

  @ApiProperty({ required: false, type: OrganizationCountDto })
  _count?: OrganizationCountDto;
}