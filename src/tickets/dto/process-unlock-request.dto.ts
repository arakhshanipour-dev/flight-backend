import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsOptional } from 'class-validator';

export enum UnlockRequestAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}

export class ProcessUnlockRequestDto {
  @ApiProperty({ enum: UnlockRequestAction, description: 'تصمیم مدیر آژانس' })
  @IsEnum(UnlockRequestAction)
  action!: UnlockRequestAction;

  @ApiProperty({ required: false, description: 'توضیحات (در صورت رد)' })
  @IsString()
  @IsOptional()
  notes?: string;
}