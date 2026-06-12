import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateAgencyUserDto {
  @ApiProperty({ example: 'user@agency.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!', description: 'گذرواژه موقت (کاربر در اولین ورود تغییر می‌دهد)' })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password!: string;

  @ApiProperty({ example: 'علی' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'رضایی' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: '09123456789', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.AGENCY_MANAGER })
  @IsEnum(UserRole)
  role!: UserRole;
}