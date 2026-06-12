import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
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
import { SupportTicketsService } from './support-tickets.service';
import {
  CreateSupportTicketDto,
  ReplyToTicketDto,
  ForwardTicketDto,
  UpdateTicketStatusDto,
  SupportTicketResponseDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupportTicketStatus, SupportTicketPriority, UserRole } from '@prisma/client';

@ApiTags('Support Tickets')
@ApiBearerAuth('JWT-auth')
@Controller('support-tickets')
export class SupportTicketsController {
  constructor(private readonly ticketsService: SupportTicketsService) {}

  // ============ Create Ticket ============

  @Post()
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ORGANIZATION_ADMIN)
  @ApiOperation({ summary: 'Create a new support ticket' })
  async create(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('organizationId') organizationId: string | null,
    @Body(ValidationPipe) dto: CreateSupportTicketDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }
    return this.ticketsService.createTicket(userId, userRole, agencyId, organizationId, dto);
  }

  // ============ Get Tickets ============

  @Get()
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ORGANIZATION_ADMIN)
  @ApiOperation({ summary: 'Get my tickets' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: SupportTicketStatus })
  async getMyTickets(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('organizationId') organizationId: string | null,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: SupportTicketStatus,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }
    return this.ticketsService.getMyTickets(
      userId,
      userRole,
      agencyId,
      organizationId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
    );
  }

  @Get(':ticketId')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a specific ticket' })
  async getTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('organizationId') organizationId: string | null,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }
    return this.ticketsService.getTicket(ticketId, userId, userRole, agencyId, organizationId);
  }

  // ============ Reply to Ticket ============

  @Post(':ticketId/reply')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER, UserRole.ORGANIZATION_ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reply to a support ticket' })
  async replyToTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('agencyId') agencyId: string | null,
    @CurrentUser('organizationId') organizationId: string | null,
    @Body(ValidationPipe) dto: ReplyToTicketDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }
    return this.ticketsService.replyToTicket(ticketId, userId, userRole, agencyId, organizationId, dto);
  }

  // ============ Forward Ticket (Agency Only) ============

  @Post(':ticketId/forward')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Forward a ticket to higher level (Agency only)' })
  async forwardTicket(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @CurrentUser('agencyId') agencyId: string | null,
    @Body(ValidationPipe) dto: ForwardTicketDto,
  ) {
    if (!userId || !agencyId) {
      throw new BadRequestException('User ID or Agency ID not found');
    }
    return this.ticketsService.forwardTicket(ticketId, userId, userRole, agencyId, dto);
  }

  // ============ Super Admin Only ============

  @Get('admin/all')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all tickets (Super Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: SupportTicketStatus })
  @ApiQuery({ name: 'senderType', required: false, type: String })
  @ApiQuery({ name: 'priority', required: false, enum: SupportTicketPriority })
  async getAllTickets(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: SupportTicketStatus,
    @Query('senderType') senderType?: string,
    @Query('priority') priority?: SupportTicketPriority,
  ) {
    return this.ticketsService.getAllTickets(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      senderType,
      priority,
    );
  }

  @Get('admin/stats')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get ticket statistics (Super Admin only)' })
  async getTicketStats() {
    return this.ticketsService.getTicketStats();
  }

  @Patch('admin/:ticketId/status')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update ticket status (Super Admin only)' })
  async updateTicketStatus(
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) dto: UpdateTicketStatusDto,
  ) {
    if (!userId) {
      throw new BadRequestException('User ID not found');
    }
    return this.ticketsService.updateTicketStatus(ticketId, userId, dto);
  }
}