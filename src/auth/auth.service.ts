import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCKOUT_TIME_MINUTES = 15;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async checkFailedAttempts(email: string): Promise<void> {
    const lockoutTimeAgo = new Date(Date.now() - this.LOCKOUT_TIME_MINUTES * 60 * 1000);
    
    const failedAttempts = await this.prisma.failedLoginAttempt.count({
      where: {
        email,
        attemptedAt: { gt: lockoutTimeAgo },
      },
    });

    if (failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      throw new ForbiddenException(
        `Too many failed attempts. Please try again after ${this.LOCKOUT_TIME_MINUTES} minutes.`
      );
    }
  }

  private async clearFailedAttempts(email: string): Promise<void> {
    await this.prisma.failedLoginAttempt.deleteMany({
      where: { email },
    });
  }

  private async recordFailedAttempt(email: string, ipAddress: string, userAgent: string): Promise<void> {
    await this.prisma.failedLoginAttempt.create({
      data: {
        email,
        ipAddress,
        userAgent,
      },
    });
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Normalize email to lowercase
    const normalizedEmail = dto.email.toLowerCase().trim();
    
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Validate password strength
    this.validatePasswordStrength(dto.password);

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

    // Hash password with salt rounds 12
    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashedPassword,
        firstName: this.sanitizeString(dto.firstName),
        lastName: this.sanitizeString(dto.lastName),
        phone: dto.phone ? this.sanitizeString(dto.phone) : null,
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

  async login(dto: LoginDto, ipAddress: string, userAgent: string): Promise<AuthResponseDto> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    
    // Check for too many failed attempts
    await this.checkFailedAttempts(normalizedEmail);

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
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
        lastLoginAt: true,
      },
    });

    if (!user) {
      await this.recordFailedAttempt(normalizedEmail, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.recordFailedAttempt(normalizedEmail, ipAddress, userAgent);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Clear failed attempts on successful login
    await this.clearFailedAttempts(normalizedEmail);

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Log successful login (optional, for security auditing)
    await this.prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        newData: { loginAt: new Date().toISOString() },
      },
    });

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    return this.generateTokens(userWithoutPassword);
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    // Check if token exists and is not revoked
    const storedToken = await this.prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const newAccessToken = this.jwtService.sign(
        {
          sub: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
        },
        {
          expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
          secret: this.configService.get('JWT_SECRET'),
        },
      );

      return { accessToken: newAccessToken };
    } catch {
      // If token verification fails, revoke it
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, refreshToken: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        token: refreshToken,
      },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out from all devices successfully' };
  }

  private async generateTokens(user: any): Promise<AuthResponseDto> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessTokenExpiresIn = this.configService.get('JWT_EXPIRES_IN', '15m');
    const refreshTokenExpiresIn = '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessTokenExpiresIn,
        secret: this.configService.get('JWT_SECRET'),
        issuer: 'airline-agency-platform',
        audience: 'airline-agency-users',
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: refreshTokenExpiresIn,
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        issuer: 'airline-agency-platform',
        audience: 'airline-agency-users',
      }),
    ]);

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt,
      },
    });

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

  private validatePasswordStrength(password: string): void {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength) {
      throw new BadRequestException(`Password must be at least ${minLength} characters long`);
    }
    if (!hasUpperCase) {
      throw new BadRequestException('Password must contain at least one uppercase letter');
    }
    if (!hasLowerCase) {
      throw new BadRequestException('Password must contain at least one lowercase letter');
    }
    if (!hasNumbers) {
      throw new BadRequestException('Password must contain at least one number');
    }
    if (!hasSpecialChar) {
      throw new BadRequestException('Password must contain at least one special character');
    }
  }

  private sanitizeString(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }
}