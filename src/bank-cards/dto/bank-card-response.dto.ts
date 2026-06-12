import { ApiProperty } from '@nestjs/swagger';
import { BankCardStatus } from '@prisma/client';

export class BankCardResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'شماره کارت (توکن شده/ماسک شده)' })
  cardNumber!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty()
  accountHolder!: string;

  @ApiProperty({ nullable: true })
  sheba!: string | null;

  @ApiProperty({ enum: BankCardStatus })
  status!: BankCardStatus;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class BankCardWithMaskedNumberDto extends BankCardResponseDto {
  @ApiProperty({ description: 'شماره کارت ماسک شده (برای نمایش در UI)' })
  maskedCardNumber!: string;
}