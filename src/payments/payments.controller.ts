import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, PaymentResponseDto } from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaymentStatus, UserRole } from '@prisma/client';

@ApiTags('Payments (Agency Panel)')
@ApiBearerAuth('JWT-auth')
@Controller('agency/payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Register a payment for an invoice (Agency Manager or General Manager)' })
  @ApiResponse({ status: 201, description: 'Payment registered successfully', type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid payment data or invoice already paid' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async create(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Body(ValidationPipe) dto: CreatePaymentDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.paymentsService.create(agencyId, userId, dto);
  }

  @Get()
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get all payments with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2025-01-01' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2025-12-31' })
  @ApiResponse({ status: 200, description: 'List of payments' })
  async findAll(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PaymentStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.paymentsService.findAll(
      agencyId,
      userId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      status,
      startDate,
      endDate,
    );
  }

  @Get('summary')
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get payment summary statistics' })
  @ApiResponse({ status: 200, description: 'Payment summary statistics' })
  async getSummary(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.paymentsService.getSummary(agencyId, userId);
  }

  @Get(':paymentId')
  @Roles(UserRole.AGENCY_MANAGER, UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Get a specific payment' })
  @ApiResponse({ status: 200, description: 'Payment details', type: PaymentResponseDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.paymentsService.findOne(agencyId, userId, paymentId);
  }

  @Delete(':paymentId')
  @Roles(UserRole.GENERAL_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete/reverse a payment (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Payment reversed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot reverse payment' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  @ApiResponse({ status: 403, description: 'Only General Manager can perform this action' })
  async delete(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.paymentsService.delete(agencyId, userId, paymentId);
  }
}