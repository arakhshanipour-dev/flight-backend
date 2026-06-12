import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ValidationPipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Plans Management (Super Admin)')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.SUPER_ADMIN)
@Controller('admin/plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new plan' })
  @ApiResponse({ status: 201, description: 'Plan created successfully', type: PlanResponseDto })
  async create(@Body(ValidationPipe) dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all plans' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.plansService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      isActiveBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a plan' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) dto: UpdatePlanDto,
  ) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a plan (only if not assigned to any agency)' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.delete(id);
  }

  // ============ System Management Endpoints ============

  @Post('system/check-expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually check and update expired plans' })
  async checkExpiredPlans() {
    return this.plansService.checkAndUpdateExpiredPlans();
  }

  @Post('system/check-expired-trials')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually check and update expired trials' })
  async checkExpiredTrials() {
    return this.plansService.checkAndUpdateExpiredTrials();
  }

  @Get('system/expiring/:days')
  @ApiOperation({ summary: 'Get plans expiring within N days' })
  async getExpiringPlans(@Param('days') days: string) {
    const daysNum = parseInt(days);
    if (isNaN(daysNum)) {
      throw new BadRequestException('Days must be a number');
    }
    return this.plansService.getExpiringPlans(daysNum);
  }
}