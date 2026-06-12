import { ApiProperty } from '@nestjs/swagger';

export class MonthlyCashFlowItemDto {
  @ApiProperty()
  month!: string;

  @ApiProperty()
  inflow!: number;

  @ApiProperty()
  outflow!: number;

  @ApiProperty()
  netCashFlow!: number;
}

export class CashFlowReportDto {
  @ApiProperty()
  period!: string;

  @ApiProperty({ type: [MonthlyCashFlowItemDto] })
  monthlyCashFlow!: MonthlyCashFlowItemDto[];

  @ApiProperty()
  totalInflow!: number;

  @ApiProperty()
  totalOutflow!: number;

  @ApiProperty()
  netCashFlow!: number;
}