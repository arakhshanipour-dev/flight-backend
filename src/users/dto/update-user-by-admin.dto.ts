import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsEmail } from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

export class UpdateUserByAdminDto {
  @ApiProperty({ required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: UserRole, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({ enum: UserStatus, required: false })
  @IsEnum(UserStatus)
  @IsOptional()
  status?: UserStatus;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  agencyId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  organizationId?: string;
}