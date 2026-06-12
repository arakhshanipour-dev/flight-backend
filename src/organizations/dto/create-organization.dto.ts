import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength, MaxLength, IsBoolean } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'سازمان هواپیمایی کشوری', description: 'نام سازمان' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '1234567890', required: false, description: 'شناسه ملی/کد اقتصادی' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  nationalId?: string;

  @ApiProperty({ example: '+982188776655', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'info@organization.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'تهران، خیابان آزادی، پلاک ۱۲۳', required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ example: false, required: false, description: 'آیا پنل داشته باشد؟' })
  @IsBoolean()
  @IsOptional()
  hasPanel?: boolean;
}