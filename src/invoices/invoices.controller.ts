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
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, UpdateInvoiceDto, InvoiceResponseDto } from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvoiceStatus, UserRole } from '@prisma/client';

@ApiTags('Invoices (Agency Panel)')
@ApiBearerAuth('JWT-auth')
@Controller('agency/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  // ============ Agency Manager & General Manager Endpoints ============

  @Post()
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Create a new invoice (Agency Manager or General Manager)' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid tickets or bank card' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async create(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.invoicesService.create(agencyId, userId, dto);
  }

  @Get()
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get all invoices with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of invoices' })
  async findAll(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('search') search?: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.invoicesService.findAll(
      agencyId,
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      search,
    );
  }

  @Get('pending-approvals')
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get pending invoices for approval (General Manager only)' })
  @ApiResponse({ status: 200, description: 'List of pending invoices' })
  async getPendingApprovals(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.invoicesService.getPendingApprovals(agencyId, userId);
  }

  @Get(':invoiceId')
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get a specific invoice' })
  @ApiResponse({ status: 200, description: 'Invoice details', type: InvoiceResponseDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.invoicesService.findOne(agencyId, userId, invoiceId);
  }

  @Patch(':invoiceId')
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Update an invoice (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Invoice updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot update paid invoice' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.invoicesService.update(agencyId, userId, invoiceId, dto);
  }

  @Post(':invoiceId/approve')
  @Roles(UserRole.GENERAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve an invoice (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Invoice approved successfully' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async approveInvoice(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.invoicesService.approveInvoice(agencyId, userId, invoiceId);
  }

  @Delete(':invoiceId')
  @Roles(UserRole.GENERAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an invoice (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Invoice deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete paid invoice or invoice with payment' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async delete(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.invoicesService.delete(agencyId, userId, invoiceId);
  }
}