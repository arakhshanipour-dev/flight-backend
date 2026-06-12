import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class RequestUnlockTicketDto {
  @ApiProperty({ example: 'میخواهم تاریخ پرواز را تغییر دهم', description: 'دلیل درخواست باز کردن بلیط' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}