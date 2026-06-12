import { PartialType } from '@nestjs/swagger';
import { CreatePlanDto } from './create-plan.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePlanDto extends PartialType(CreatePlanDto) {
  @ApiProperty({ required: false, description: 'فعال/غیرفعال کردن پلن' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}