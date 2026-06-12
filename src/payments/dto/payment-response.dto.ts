import { ApiProperty } from '@nestjs/swagger';
import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  invoiceId!: string;

  @ApiProperty()
  invoiceNumber!: string;

  @ApiProperty()
  agencyId!: string;

  @ApiProperty()
  bankCardId!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty({ nullable: true })
  trackingCode!: string | null;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ nullable: true })
  paidAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}