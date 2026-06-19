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
import { AirlinesService } from './airlines.service';
import {
  CreateAirlineDto,
  UpdateAirlineDto,
  AirlineResponseDto,
  AirlineListResponseDto,
  AirlinePopularDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Airlines Management')
@ApiBearerAuth('JWT-auth')
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly airlinesService: AirlinesService) {}

  // ============ Admin Endpoints (SUPER_ADMIN only) ============

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new airline (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Airline created successfully', type: AirlineResponseDto })
  @ApiResponse({ status: 409, description: 'Airline with this IATA/ICAO code already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden - Super Admin only' })
  async create(
    @CurrentUser('id') adminId: string,
    @Body(ValidationPipe) dto: CreateAirlineDto,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.airlinesService.create(adminId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Update an airline (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Airline updated successfully', type: AirlineResponseDto })
  @ApiResponse({ status: 404, description: 'Airline not found' })
  @ApiResponse({ status: 409, description: 'Airline with this IATA/ICAO code already exists' })
  async update(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdateAirlineDto,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.airlinesService.update(adminId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete an airline (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Airline deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete airline with existing tickets' })
  @ApiResponse({ status: 404, description: 'Airline not found' })
  async delete(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.airlinesService.delete(adminId, id);
  }

  // ============ Public Endpoints (All authenticated users) ============

  @Get()
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all airlines with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Airlines retrieved successfully', type: AirlineListResponseDto })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.airlinesService.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? Math.min(parseInt(limit), 100) : 20,
      search,
      isActive: isActiveBool,
    });
  }

  @Get('popular')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get most popular airlines (by ticket count)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Popular airlines retrieved successfully', type: [AirlinePopularDto] })
  async getPopularAirlines(@Query('limit') limit?: string) {
    return this.airlinesService.getPopularAirlines(limit ? parseInt(limit) : 10);
  }

  @Get('search')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Search airlines by IATA, ICAO, or name' })
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
    return this.airlinesService.search(q, limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get airline by ID' })
  @ApiResponse({ status: 200, description: 'Airline found', type: AirlineResponseDto })
  @ApiResponse({ status: 404, description: 'Airline not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.airlinesService.findOne(id);
  }

  @Get('iata/:iataCode')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get airline by IATA code' })
  @ApiResponse({ status: 200, description: 'Airline found', type: AirlineResponseDto })
  @ApiResponse({ status: 404, description: 'Airline not found' })
  async findByIata(@Param('iataCode') iataCode: string) {
    return this.airlinesService.findByIata(iataCode.toUpperCase());
  }

  @Get('icao/:icaoCode')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get airline by ICAO code' })
  @ApiResponse({ status: 200, description: 'Airline found', type: AirlineResponseDto })
  @ApiResponse({ status: 404, description: 'Airline not found' })
  async findByIcao(@Param('icaoCode') icaoCode: string) {
    return this.airlinesService.findByIcao(icaoCode.toUpperCase());
  }
}