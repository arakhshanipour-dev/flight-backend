import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRegistrationRequestDto, UpdateRegistrationRequestDto } from './dto';
import { RegistrationRequestStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';   // ← Add this line

@Injectable()
export class RegistrationRequestsService {
  constructor(private prisma: PrismaService) {}

  // ============ Public Methods (No Auth Required) ============

  async create(dto: CreateRegistrationRequestDto) {
    // Check if email already has a pending request
    const existingRequest = await this.prisma.registrationRequest.findFirst({
      where: {
        contactEmail: dto.contactEmail,
        status: {
          in: [RegistrationRequestStatus.PENDING, RegistrationRequestStatus.CONTACTED],
        },
      },
    });

    if (existingRequest) {
      throw new BadRequestException('You already have a pending request. Our team will contact you soon.');
    }

    // Check if agency with this email already exists
    const existingAgency = await this.prisma.agency.findUnique({
      where: { email: dto.contactEmail },
    });

    if (existingAgency) {
      throw new BadRequestException('An agency with this email already exists in our system.');
    }

    const request = await this.prisma.registrationRequest.create({
      data: {
        agencyName: dto.agencyName,
        registrationNumber: dto.registrationNumber,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        message: dto.message,
        status: RegistrationRequestStatus.PENDING,
      },
    });

    return request;
  }

  // ============ Admin Only Methods (Support Team) ============

  async findAll(
    page: number = 1,
    limit: number = 20,
    status?: RegistrationRequestStatus,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { agencyName: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [requests, total] = await Promise.all([
      this.prisma.registrationRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agency: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.registrationRequest.count({ where }),
    ]);

    return {
      data: requests,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const request = await this.prisma.registrationRequest.findUnique({
      where: { id },
      include: {
        agency: true,
      },
    });

    if (!request) {
      throw new NotFoundException(`Registration request with ID ${id} not found`);
    }

    return request;
  }

  async update(id: string, dto: UpdateRegistrationRequestDto, reviewerId: string) {
    const request = await this.findOne(id);

    const updateData: any = {
      ...dto,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
    };

    // If status is being changed to DEMO_CREATED, we need an agencyId
    if (dto.status === RegistrationRequestStatus.DEMO_CREATED && !request.agencyId) {
      throw new BadRequestException(
        'Cannot set status to DEMO_CREATED without creating an agency first. Use the createAgencyFromRequest endpoint.',
      );
    }

    const updated = await this.prisma.registrationRequest.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async createAgencyFromRequest(
    requestId: string,
    reviewerId: string,
    planId: string,
    trialDays: number = 30,
  ) {
    const request = await this.findOne(requestId);

    if (request.status !== RegistrationRequestStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot create agency. Request status must be APPROVED, current status: ${request.status}`,
      );
    }

    if (request.agencyId) {
      throw new BadRequestException('Agency has already been created for this request');
    }

    // Create the agency
    const agency = await this.prisma.agency.create({
      data: {
        name: request.agencyName,
        registrationNumber: request.registrationNumber,
        phone: request.contactPhone,
        email: request.contactEmail,
        status: 'TRIAL',
        trialExpiresAt: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
      },
    });

    // Create AgencyPlan
    await this.prisma.agencyPlan.create({
      data: {
        agencyId: agency.id,
        planId: planId,
        startDate: new Date(),
        endDate: new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000),
        isActive: true,
      },
    });

    // Create General Manager user for the agency
    const hashedPassword = await bcrypt.hash('Welcome123!', 10); // Temporary password, should be changed on first login

    await this.prisma.user.create({
      data: {
        email: request.contactEmail,
        passwordHash: hashedPassword,
        firstName: request.contactName.split(' ')[0] || request.contactName,
        lastName: request.contactName.split(' ')[1] || '',
        phone: request.contactPhone,
        role: UserRole.GENERAL_MANAGER,
        agencyId: agency.id,
        status: 'ACTIVE',
      },
    });

    // Update the registration request
    await this.prisma.registrationRequest.update({
      where: { id: requestId },
      data: {
        status: RegistrationRequestStatus.DEMO_CREATED,
        agencyId: agency.id,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        notes: request.notes 
          ? `${request.notes}\n\n[Agency created with trial plan. Temporary password: Welcome123!]`
          : `[Agency created with trial plan. Temporary password: Welcome123!]`,
      },
    });

    return {
      agency,
      message: `Agency created successfully. Temporary password: Welcome123! (User must change password on first login)`,
    };
  }

  async delete(id: string) {
    const request = await this.findOne(id);
    
    await this.prisma.registrationRequest.delete({
      where: { id },
    });

    return { message: 'Registration request deleted successfully' };
  }

  async getStats() {
    const stats = await this.prisma.registrationRequest.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    const total = await this.prisma.registrationRequest.count();

    return {
      total,
      breakdown: stats.map(s => ({
        status: s.status,
        count: s._count.status,
      })),
    };
  }
}