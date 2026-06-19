import { ApiProperty } from '@nestjs/swagger';
import { AirportType } from '@prisma/client';

export class AirportResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  iataCode!: string;

  @ApiProperty({ nullable: true })
  icaoCode!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty({ nullable: true })
  timezone!: string | null;

  @ApiProperty({ enum: AirportType })
  type!: AirportType;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiProperty({ required: false })
  _count?: {
    originTickets: number;
    destinationTickets: number;
  };
}

export class AirportListResponseDto {
  @ApiProperty({ type: [AirportResponseDto] })
  data!: AirportResponseDto[];

  @ApiProperty()
  meta!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class AirportPopularDto {
  @ApiProperty()
  airportId!: string;

  @ApiProperty()
  airportName!: string;

  @ApiProperty()
  iataCode!: string;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  province!: string;

  @ApiProperty()
  count!: number;
}