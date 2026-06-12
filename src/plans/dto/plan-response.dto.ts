import { ApiProperty } from '@nestjs/swagger';

export class PlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description!: string | null;

  @ApiProperty()
  priceMonthly!: number;

  @ApiProperty()
  priceYearly!: number;

  @ApiProperty()
  maxNormalUsers!: number;

  @ApiProperty()
  maxAgencyManagers!: number;

  @ApiProperty({ nullable: true })
  maxTicketsPerMonth!: number | null;

  @ApiProperty({ nullable: true })
  maxInvoicesPerMonth!: number | null;

  @ApiProperty()
  features!: any;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}