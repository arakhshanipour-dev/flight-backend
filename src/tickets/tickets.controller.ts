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
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  UpdateTicketDto,
  TicketResponseDto,
  RequestUnlockTicketDto,
  ProcessUnlockRequestDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, TicketStatus } from '@prisma/client';

@ApiTags('Tickets (Agency Panel)')
@ApiBearerAuth('JWT-auth')
@Controller('agency/tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ============ Normal User & Manager Endpoints ============

  @Post()
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Create a new ticket (Normal User or Manager)' })
  async create(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body() dto: CreateTicketDto,
  ) {
    return this.ticketsService.create(agencyId, userId, dto);
  }

  @Get()
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get all tickets with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: TicketStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: TicketStatus,
    @Query('search') search?: string,
  ) {
    return this.ticketsService.findAll(
      agencyId,
      userId,
      userRole,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      search,
    );
  }

  @Get(':ticketId')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get a specific ticket' })
  async findOne(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.findOne(agencyId, userId, userRole, ticketId);
  }

  @Patch(':ticketId')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Update a ticket' })
  async update(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.ticketsService.update(agencyId, userId, userRole, ticketId, dto);
  }

  @Delete(':ticketId')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a ticket (only if not invoiced or finalized)' })
  async delete(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.delete(agencyId, userId, userRole, ticketId);
  }

  // ============ Unlock Request Endpoints ============

  @Post(':ticketId/request-unlock')
  @Roles(UserRole.NORMAL_USER)
  @ApiOperation({ summary: 'Request to unlock a finalized/invoiced ticket (Normal User only)' })
  async requestUnlock(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: RequestUnlockTicketDto,
  ) {
    return this.ticketsService.requestUnlock(agencyId, userId, ticketId, dto);
  }

  @Get('unlock-requests')
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get all unlock requests (Agency Manager only)' })
  async getUnlockRequests(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.ticketsService.getUnlockRequests(agencyId, userId, userRole);
  }

  @Post('unlock-requests/:requestId/process')
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Approve or reject an unlock request' })
  async processUnlockRequest(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') managerId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ProcessUnlockRequestDto,
  ) {
    return this.ticketsService.processUnlockRequest(agencyId, managerId, requestId, dto);
  }

  // ============ General Manager Only Endpoints ============

  @Post(':ticketId/force-unlock')
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Force unlock a ticket (General Manager only)' })
  async forceUnlockTicket(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') managerId: string,
    @Param('ticketId') ticketId: string,
  ) {
    return this.ticketsService.forceUnlockTicket(agencyId, managerId, ticketId);
  }
}