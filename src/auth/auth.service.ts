import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus } from '@prisma/client';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate agency for agency-specific roles
    if (dto.role !== UserRole.SUPER_ADMIN && dto.role !== UserRole.ORGANIZATION_ADMIN) {
      if (!dto.agencyId) {
        throw new BadRequestException('Agency ID is required for this role');
      }

      const agency = await this.prisma.agency.findUnique({
        where: { id: dto.agencyId },
      });

      if (!agency) {
        throw new BadRequestException('Agency not found');
      }

      // Check plan limits
      await this.checkAgencyUserLimits(dto.agencyId, dto.role);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: dto.role,
        agencyId: dto.agencyId,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        agencyId: true,
        organizationId: true,
      },
    });

    // Generate tokens
    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        agencyId: true,
        organizationId: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    return this.generateTokens(userWithoutPassword);
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newAccessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      return { accessToken: newAccessToken };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async generateTokens(user: any): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '7d'),
        secret: this.configService.get('JWT_SECRET'),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: '30d',
        secret: this.configService.get('JWT_SECRET'),
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        agencyId: user.agencyId,
        organizationId: user.organizationId,
      },
    };
  }

  private async checkAgencyUserLimits(agencyId: string, role: UserRole) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
      include: {
        agencyPlans: {
          where: { isActive: true, endDate: null },
          include: { plan: true },
        },
        users: {
          where: { status: UserStatus.ACTIVE },
        },
      },
    });

    const activePlan = agency?.agencyPlans[0]?.plan;
    if (!activePlan) return;

    if (role === UserRole.NORMAL_USER) {
      const normalUserCount = agency?.users.filter(
        u => u.role === UserRole.NORMAL_USER,
      ).length || 0;

      if (normalUserCount >= activePlan.maxNormalUsers) {
        throw new BadRequestException(
          `Maximum number of normal users (${activePlan.maxNormalUsers}) reached for this agency`,
        );
      }
    }

    if (role === UserRole.AGENCY_MANAGER) {
      const managerCount = agency?.users.filter(
        u => u.role === UserRole.AGENCY_MANAGER,
      ).length || 0;

      if (managerCount >= activePlan.maxAgencyManagers) {
        throw new BadRequestException(
          `Maximum number of agency managers (${activePlan.maxAgencyManagers}) reached for this agency`,
        );
      }
    }
  }
}