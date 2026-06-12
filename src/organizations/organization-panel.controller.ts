import {
  Controller,
  Get,
  Param,
  Query,
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
import { OrganizationsService } from './organizations.service';
import {
  OrganizationInvoiceResponseDto,
  OrganizationStatsDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, InvoiceStatus } from '@prisma/client';

@ApiTags('Organization Panel')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.ORGANIZATION_ADMIN)
@Controller('organization')
export class OrganizationPanelController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get organization profile' })
  @ApiResponse({ status: 200, description: 'Organization profile retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getMyProfile(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID not found');
    }
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }
    return this.organizationsService.getMyProfile(organizationId, userId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get all invoices for this organization' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of invoices', type: [OrganizationInvoiceResponseDto] })
  async getMyInvoices(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('search') search?: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID not found');
    }
    return this.organizationsService.getMyInvoices(
      organizationId,
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      search,
    );
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({ summary: 'Get a specific invoice' })
  @ApiResponse({ status: 200, description: 'Invoice details', type: OrganizationInvoiceResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getMyInvoice(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID not found');
    }
    return this.organizationsService.getMyInvoice(organizationId, userId, invoiceId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get organization statistics' })
  @ApiResponse({ status: 200, description: 'Organization statistics', type: OrganizationStatsDto })
  async getMyStats(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID not found');
    }
    return this.organizationsService.getMyStats(organizationId, userId);
  }

  @Get('agencies')
  @ApiOperation({ summary: 'Get all agencies that have issued invoices to this organization' })
  @ApiResponse({ status: 200, description: 'List of agencies' })
  async getAvailableAgencies(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID not found');
    }
    return this.organizationsService.getAvailableAgencies(organizationId, userId);
  }
}