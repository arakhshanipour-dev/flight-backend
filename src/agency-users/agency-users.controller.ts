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
import { AgencyUsersService } from './agency-users.service';
import {
  CreateAgencyUserDto,
  UpdateAgencyUserDto,
  AgencyUserResponseDto,
} from './dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, UserStatus } from '@prisma/client';

@ApiTags('Agency Users Management (General Manager Panel)')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.GENERAL_MANAGER)
@Controller('agency/users')
export class AgencyUsersController {
  constructor(private readonly agencyUsersService: AgencyUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users in the agency (General Manager only)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') currentUserId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.agencyUsersService.findAll(
      agencyId,
      currentUserId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
    );
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get a specific user details' })
  async findOne(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.agencyUsersService.findOne(agencyId, currentUserId, userId);
  }

  @Get(':userId/penalties')
  @ApiOperation({ summary: 'Get user penalties (for normal users)' })
  async getUserPenalties(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.agencyUsersService.getUserPenalties(agencyId, currentUserId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new user (Agency Manager or Normal User)' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: AgencyUserResponseDto })
  async create(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') currentUserId: string,
    @Body() dto: CreateAgencyUserDto,
  ) {
    return this.agencyUsersService.create(agencyId, currentUserId, dto);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateAgencyUserDto,
  ) {
    return this.agencyUsersService.update(agencyId, currentUserId, userId, dto);
  }

  @Patch(':userId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate a user' })
  async changeStatus(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
    @Body('status') status: UserStatus,
  ) {
    return this.agencyUsersService.changeStatus(agencyId, currentUserId, userId, status);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user (only if no tickets exist)' })
  async delete(
    @CurrentUser('agencyId') agencyId: string,
    @CurrentUser('id') currentUserId: string,
    @Param('userId') userId: string,
  ) {
    return this.agencyUsersService.delete(agencyId, currentUserId, userId);
  }
}