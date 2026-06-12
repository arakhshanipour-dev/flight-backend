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
import { OrganizationsService } from './organizations.service';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  OrganizationResponseDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Organizations Management (Super Admin)')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Organization created successfully', type: OrganizationResponseDto })
  @ApiResponse({ status: 409, description: 'Organization with this name, email, or national ID already exists' })
  async create(
    @CurrentUser('id') adminId: string,
    @Body(ValidationPipe) dto: CreateOrganizationDto,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.organizationsService.create(adminId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all organizations with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'hasPanel', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'List of organizations' })
  async findAll(
    @CurrentUser('id') adminId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('hasPanel') hasPanel?: string,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    const hasPanelBool = hasPanel === 'true' ? true : hasPanel === 'false' ? false : undefined;
    return this.organizationsService.findAll(
      adminId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      hasPanelBool,
    );
  }

  @Get(':organizationId')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: 200, description: 'Organization details', type: OrganizationResponseDto })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findOne(
    @CurrentUser('id') adminId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.organizationsService.findOne(adminId, organizationId);
  }

  @Patch(':organizationId')
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: 200, description: 'Organization updated successfully', type: OrganizationResponseDto })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async update(
    @CurrentUser('id') adminId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body(ValidationPipe) dto: UpdateOrganizationDto,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.organizationsService.update(adminId, organizationId, dto);
  }

  @Post(':organizationId/create-admin')
  @ApiOperation({ summary: 'Create an admin user for the organization' })
  @ApiResponse({ status: 201, description: 'Organization admin created successfully' })
  @ApiResponse({ status: 400, description: 'Organization does not have a panel' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async createOrganizationAdmin(
    @CurrentUser('id') adminId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body(ValidationPipe) body: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.organizationsService.createOrganizationAdmin(
      adminId,
      organizationId,
      body.email,
      body.firstName,
      body.lastName,
      body.phone,
    );
  }

  @Delete(':organizationId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete organization (only if no invoices exist)' })
  @ApiResponse({ status: 200, description: 'Organization deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete organization with existing invoices' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async delete(
    @CurrentUser('id') adminId: string,
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.organizationsService.delete(adminId, organizationId);
  }
}