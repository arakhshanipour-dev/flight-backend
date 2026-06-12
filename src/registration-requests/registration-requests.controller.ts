import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RegistrationRequestsService } from './registration-requests.service';
import {
  CreateRegistrationRequestDto,
  UpdateRegistrationRequestDto,
  RegistrationRequestResponseDto,
} from './dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { UserRole, RegistrationRequestStatus } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Registration Requests')
@Controller('registration-requests')
export class RegistrationRequestsController {
  constructor(private readonly service: RegistrationRequestsService) {}

  // ============ Public Endpoint (No Auth) ============
  
  @Public()
  @Post()
  @ApiOperation({ summary: 'Submit a registration request for an agency' })
  @ApiResponse({ status: 201, description: 'Request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or duplicate request' })
  async create(@Body() dto: CreateRegistrationRequestDto) {
    return this.service.create(dto);
  }

  // ============ Admin Only Endpoints (Support Team) ============

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all registration requests (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: RegistrationRequestStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: RegistrationRequestStatus,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      search,
    );
  }

  @Get('stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get registration request statistics (Admin only)' })
  async getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get a specific registration request by ID' })
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a registration request (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRegistrationRequestDto,
    @CurrentUser('id') reviewerId: string,
  ) {
    return this.service.update(id, dto, reviewerId);
  }

  @Post(':id/create-agency')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create an agency from an approved registration request' })
  @ApiResponse({ status: 201, description: 'Agency created successfully' })
  async createAgencyFromRequest(
    @Param('id') id: string,
    @CurrentUser('id') reviewerId: string,
    @Body('planId') planId: string,
    @Body('trialDays') trialDays?: number,
  ) {
    return this.service.createAgencyFromRequest(id, reviewerId, planId, trialDays || 30);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete a registration request (Admin only)' })
  async delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}