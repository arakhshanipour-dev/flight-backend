import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateRegistrationRequestDto } from './create-registration-request.dto';
import { IsEnum, IsString, IsOptional } from 'class-validator';
import { RegistrationRequestStatus } from '@prisma/client';

export class UpdateRegistrationRequestDto extends PartialType(CreateRegistrationRequestDto) {
  @ApiProperty({ enum: RegistrationRequestStatus, required: false })
  @IsEnum(RegistrationRequestStatus)
  @IsOptional()
  status?: RegistrationRequestStatus;

  @ApiProperty({ example: 'با کاربر تماس گرفته شد، نیاز به مدارک بیشتر دارد', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}