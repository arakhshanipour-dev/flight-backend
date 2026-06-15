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
  ApiProperty,
} from '@nestjs/swagger';
import { BankCardsService } from './bank-cards.service';
import {
  CreateBankCardDto,
  UpdateBankCardDto,
  BankCardResponseDto,
  BankCardWithMaskedNumberDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BankCardStatus, UserRole } from '@prisma/client';

// DTO for status change
export class ChangeCardStatusDto {
  @ApiProperty({ enum: BankCardStatus, description: 'وضعیت جدید کارت' })
  status!: BankCardStatus;
}

@ApiTags('Bank Cards (Agency Panel)')
@ApiBearerAuth('JWT-auth')
@Controller('agency/bank-cards')
export class BankCardsController {
  constructor(private readonly bankCardsService: BankCardsService) {}

  // ============ Operations for GENERAL_MANAGER only ============

  @Post()
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Create a new bank card (General Manager only)' })
  @ApiResponse({ status: 201, description: 'Bank card created successfully', type: BankCardWithMaskedNumberDto })
  @ApiResponse({ status: 403, description: 'Forbidden - Only General Manager can manage bank cards' })
  @ApiResponse({ status: 409, description: 'Card number already exists' })
  async create(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBankCardDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.bankCardsService.create(agencyId, userId, dto);
  }

  @Patch(':cardId')
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Update a bank card (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Bank card updated successfully', type: BankCardResponseDto })
  @ApiResponse({ status: 404, description: 'Bank card not found' })
  async update(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body() dto: UpdateBankCardDto,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.bankCardsService.update(agencyId, userId, cardId, dto);
  }

  @Patch(':cardId/status')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Activate or deactivate a bank card (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Card status updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate the only active card' })
  @ApiResponse({ status: 404, description: 'Bank card not found' })
  async changeStatus(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
    @Body('status') status: BankCardStatus,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    if (!status || !Object.values(BankCardStatus).includes(status)) {
      throw new BadRequestException('Valid status is required');
    }
    return this.bankCardsService.changeStatus(agencyId, userId, cardId, status);
  }

  @Post(':cardId/set-default')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Set a bank card as default (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Default card updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot set inactive card as default' })
  @ApiResponse({ status: 404, description: 'Bank card not found' })
  async setDefault(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.bankCardsService.setDefault(agencyId, userId, cardId);
  }

  @Delete(':cardId')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.GENERAL_MANAGER)
  @ApiOperation({ summary: 'Delete a bank card (General Manager only)' })
  @ApiResponse({ status: 200, description: 'Bank card deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete card that has been used or is the only active card' })
  @ApiResponse({ status: 404, description: 'Bank card not found' })
  async delete(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.bankCardsService.delete(agencyId, userId, cardId);
  }

  // ============ Read-only operations for both GENERAL_MANAGER and AGENCY_MANAGER ============

  @Get()
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'Get all bank cards for this agency (General Manager and Agency Manager)' })
  @ApiQuery({ name: 'status', required: false, enum: BankCardStatus })
  @ApiResponse({ status: 200, description: 'List of bank cards', type: [BankCardWithMaskedNumberDto] })
  async findAll(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Query('status') status?: BankCardStatus,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.bankCardsService.findAll(agencyId, userId, status);
  }

  @Get('default')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'Get the default bank card' })
  @ApiResponse({ status: 200, description: 'Default bank card', type: BankCardResponseDto })
  async getDefaultCard(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.bankCardsService.getDefaultCard(agencyId, userId);
  }

  @Get(':cardId')
  @Roles(UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER)
  @ApiOperation({ summary: 'Get a specific bank card' })
  @ApiResponse({ status: 200, description: 'Bank card details', type: BankCardWithMaskedNumberDto })
  @ApiResponse({ status: 404, description: 'Bank card not found' })
  async findOne(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') userId: string,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ) {
    if (!agencyId) {
      throw new BadRequestException('Agency ID not found');
    }
    return this.bankCardsService.findOne(agencyId, userId, cardId);
  }
}