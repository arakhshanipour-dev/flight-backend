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
import { AgenciesService } from './agencies.service';
import {
  CreateAgencyDto,
  UpdateAgencyDto,
  AgencyResponseDto,
  ChangeAgencyPlanDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, AgencyStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

class ChangeStatusDto {
  @IsEnum(AgencyStatus)
  status!: AgencyStatus;
}

@ApiTags('Agencies Management (Support Panel)')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.SUPER_ADMIN) // 🔥 فقط SUPER_ADMIN
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a new agency (Support only)' })
  @ApiResponse({ status: 201, description: 'Agency created successfully' })
  @ApiResponse({ status: 409, description: 'Agency with this name/email already exists' })
  async create(
    @Body() dto: CreateAgencyDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.agenciesService.create(dto, adminId);
  }

  @Get()
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get all agencies with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: AgencyStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Agencies retrieved successfully' })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: AgencyStatus,
    @Query('search') search?: string,
  ) {
    return this.agenciesService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      search,
    );
  }

  @Get('stats/:id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get dashboard statistics for an agency' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getDashboardStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getDashboardStats(id);
  }

  @Get(':id/plan-history')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Get plan change history for an agency' })
  @ApiResponse({ status: 200, description: 'Plan history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async getPlanHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.getPlanHistory(id);
  }

  @Get(':id')
  @Throttle({ default: { limit: 50, ttl: 60000 } })
  @ApiOperation({ summary: 'Get agency by ID with full details' })
  @ApiResponse({ status: 200, description: 'Agency found successfully', type: AgencyResponseDto })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.findOne(id, true);
  }

  @Patch(':id')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Update agency information' })
  @ApiResponse({ status: 200, description: 'Agency updated successfully', type: AgencyResponseDto })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() dto: UpdateAgencyDto
  ) {
    return this.agenciesService.update(id, dto);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Change agency status (activate/deactivate/suspend)' })
  @ApiResponse({ status: 200, description: 'Agency status updated successfully' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: AgencyStatus,
  ) {
    if (!status || !Object.values(AgencyStatus).includes(status)) {
      throw new BadRequestException('Valid status is required');
    }
    return this.agenciesService.changeStatus(id, status);
  }

  @Post(':id/change-plan')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Change agency subscription plan' })
  @ApiResponse({ status: 200, description: 'Plan changed successfully' })
  @ApiResponse({ status: 404, description: 'Agency or plan not found' })
  async changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeAgencyPlanDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.agenciesService.changePlan(id, dto, adminId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Delete an agency (only if no invoices exist)' })
  @ApiResponse({ status: 200, description: 'Agency deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete agency with existing invoices' })
  @ApiResponse({ status: 404, description: 'Agency not found' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.agenciesService.delete(id);
  }
}