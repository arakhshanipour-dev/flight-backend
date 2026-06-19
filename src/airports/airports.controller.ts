import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AirportsService } from './airports.service';
import {
  CreateAirportDto,
  UpdateAirportDto,
  AirportResponseDto,
  AirportListResponseDto,
  AirportPopularDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, AirportType } from '@prisma/client';

@ApiTags('Airports Management')
@ApiBearerAuth('JWT-auth')
@Controller('airports')
export class AirportsController {
  constructor(private readonly airportsService: AirportsService) {}

  // ============ Admin Endpoints (SUPER_ADMIN only) ============

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new airport (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Airport created successfully', type: AirportResponseDto })
  @ApiResponse({ status: 409, description: 'Airport with this IATA/ICAO code already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async create(
    @CurrentUser('id') adminId: string,
    @Body(ValidationPipe) dto: CreateAirportDto,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.airportsService.create(adminId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Update an airport (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Airport updated successfully', type: AirportResponseDto })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  @ApiResponse({ status: 409, description: 'Airport with this IATA/ICAO code already exists' })
  async update(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdateAirportDto,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.airportsService.update(adminId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete an airport (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Airport deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete airport with existing tickets' })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  async delete(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.airportsService.delete(adminId, id);
  }

  // ============ Public Endpoints (All authenticated users) ============

  @Get()
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all airports with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'type', required: false, enum: AirportType })
  @ApiQuery({ name: 'province', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Airports retrieved successfully', type: AirportListResponseDto })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: AirportType,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.airportsService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? Math.min(parseInt(limit), 100) : 20,
      type,
      province,
      city,
      search,
      isActive: isActiveBool,
    });
  }

  @Get('popular')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get most popular airports (by ticket count)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Popular airports retrieved successfully', type: [AirportPopularDto] })
  async getPopularAirports(@Query('limit') limit?: string) {
    return this.airportsService.getPopularAirports(limit ? parseInt(limit) : 10);
  }

  @Get('provinces')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all provinces with airport count' })
  @ApiResponse({ status: 200, description: 'Provinces retrieved successfully' })
  async getProvinces() {
    return this.airportsService.getProvinces();
  }

  @Get('search')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Search airports by IATA, ICAO, or name' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query (min 2 characters)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 10 })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    if (!q || q.length < 2) {
      return { data: [] };
    }
    return this.airportsService.search(q, limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get airport by ID' })
  @ApiResponse({ status: 200, description: 'Airport found', type: AirportResponseDto })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.airportsService.findOne(id);
  }

  @Get('iata/:iataCode')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get airport by IATA code' })
  @ApiResponse({ status: 200, description: 'Airport found', type: AirportResponseDto })
  @ApiResponse({ status: 404, description: 'Airport not found' })
  async findByIata(@Param('iataCode') iataCode: string) {
    return this.airportsService.findByIata(iataCode.toUpperCase());
  }

  @Get('province/:province')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get airports by province' })
  @ApiResponse({ status: 200, description: 'Airports retrieved successfully', type: [AirportResponseDto] })
  async findByProvince(@Param('province') province: string) {
    return this.airportsService.findByProvince(province);
  }

  @Get('city/:city')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get airports by city' })
  @ApiResponse({ status: 200, description: 'Airports retrieved successfully', type: [AirportResponseDto] })
  async findByCity(@Param('city') city: string) {
    return this.airportsService.findByCity(city);
  }
}