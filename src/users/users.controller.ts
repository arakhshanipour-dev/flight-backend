import {
  Controller,
  Get,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Post,
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
import { UsersService } from './users.service';
import { UpdateUserByAdminDto } from './dto/update-user-by-admin.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, UserStatus } from '@prisma/client';

@ApiTags('Users Management (Support Panel)')
@ApiBearerAuth('JWT-auth')
@Roles(UserRole.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Get all users with pagination and filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus })
  @ApiQuery({ name: 'agencyId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('agencyId') agencyId?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      role,
      status,
      agencyId,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID with full details' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/penalties')
  @ApiOperation({ summary: 'Get user penalties (for normal users)' })
  async getPenalties(@Param('id') id: string) {
    return this.usersService.getPenalties(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserByAdminDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.updateByAdmin(id, dto, adminId);
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user status (activate/deactivate/suspend)' })
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: UserStatus,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.changeStatus(id, status, adminId);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password (generates temporary password)' })
  async resetPassword(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.usersService.resetPassword(id, adminId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a user' })
  async delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}