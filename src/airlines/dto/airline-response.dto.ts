import { ApiProperty } from '@nestjs/swagger';

export class AirlineResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  iataCode!: string;

  @ApiProperty({ nullable: true })
  icaoCode!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  country!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
  _count?: {
    tickets: number;
  };
}

export class AirlineListResponseDto {
  @ApiProperty({ type: [AirlineResponseDto] })
  data!: AirlineResponseDto[];

  @ApiProperty()
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class AirlinePopularDto {
  @ApiProperty()
  airlineId!: string;

  @ApiProperty()
  airlineName!: string;

  @ApiProperty()
  iataCode!: string;

  @ApiProperty()
  count!: number;
}