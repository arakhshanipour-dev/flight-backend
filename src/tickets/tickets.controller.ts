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

  @Post()
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Create a new ticket' })
  async create(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body(ValidationPipe) dto: CreateTicketDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
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
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
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
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.ticketsService.findOne(agencyId, userId, userRole, ticketId);
  }

  @Patch(':ticketId')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Update a ticket' })
  async update(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body(ValidationPipe) dto: UpdateTicketDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.ticketsService.update(agencyId, userId, userRole, ticketId, dto);
  }

  @Delete(':ticketId')
  @Roles(UserRole.NORMAL_USER, UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a ticket' })
  async delete(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.ticketsService.delete(agencyId, userId, userRole, ticketId);
  }

  @Post(':ticketId/request-unlock')
  @Roles(UserRole.NORMAL_USER)
  @ApiOperation({ summary: 'Request to unlock a finalized/invoiced ticket' })
  async requestUnlock(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body(ValidationPipe) dto: RequestUnlockTicketDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.ticketsService.requestUnlock(agencyId, userId, ticketId, dto);
  }

  @Get('unlock-requests')
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get all unlock requests' })
  async getUnlockRequests(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.ticketsService.getUnlockRequests(agencyId, userId, userRole);
  }

  @Post('unlock-requests/:requestId/process')
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Approve or reject an unlock request' })
  async processUnlockRequest(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') managerId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body(ValidationPipe) dto: ProcessUnlockRequestDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.ticketsService.processUnlockRequest(agencyId, managerId, requestId, dto);
  }

  @Post(':ticketId/force-unlock')
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Force unlock a ticket (General Manager only)' })
  async forceUnlockTicket(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') managerId: string,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.ticketsService.forceUnlockTicket(agencyId, managerId, ticketId);
  }
}