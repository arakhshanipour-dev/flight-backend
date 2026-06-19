import { ApiProperty } from '@nestjs/swagger';

class ActivityLogUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;
}

export class ActivityLogResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ nullable: true })
  agencyId!: string | null;

  @ApiProperty({ nullable: true })
  organizationId!: string | null;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  entityType!: string;

  @ApiProperty({ nullable: true })
  entityId!: string | null;

  @ApiProperty({ nullable: true })
  oldData!: any;

  @ApiProperty({ nullable: true })
  newData!: any;

  @ApiProperty({ nullable: true })
  ipAddress!: string | null;

  @ApiProperty({ nullable: true })
  userAgent!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ type: ActivityLogUserDto, nullable: true })
  user?: ActivityLogUserDto | null;

  @ApiProperty({ nullable: true })
  agencyName?: string | null;

  @ApiProperty({ nullable: true })
  organizationName?: string | null;
}

export class ActivityLogListResponseDto {
  @ApiProperty({ type: [ActivityLogResponseDto] })
  data!: ActivityLogResponseDto[];

  @ApiProperty()
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}