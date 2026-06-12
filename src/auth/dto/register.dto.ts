import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Password123!', description: 'User password' })
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password!: string;

  @ApiProperty({ example: 'John', description: 'First name' })
  @IsString()
  firstName!: string;

  @ApiProperty({ example: 'Doe', description: 'Last name' })
  @IsString()
  lastName!: string;

  @ApiProperty({ example: '+1234567890', required: false, description: 'Phone number' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.NORMAL_USER, description: 'User role' })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ example: 'agency-uuid', required: false, description: 'Agency ID (if applicable)' })
  @IsString()
  @IsOptional()
  agencyId?: string;
}