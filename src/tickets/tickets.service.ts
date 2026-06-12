import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { CreateTicketDto, UpdateTicketDto, RequestUnlockTicketDto, ProcessUnlockRequestDto, UnlockRequestAction } from './dto';
import { TicketStatus, UserRole, UserStatus, AgencyStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private plansService: PlansService,
  ) {}

  // ============ Helper Methods ============

  private async validateAgencyAccess(agencyId: string, userId: string, requiredRole?: UserRole) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new NotFoundException('Agency not found');
    }

    if (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL) {
      throw new ForbiddenException('Agency is not active');
    }

    if (requiredRole) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          agencyId: agencyId,
          status: UserStatus.ACTIVE,
        },
      });

      if (!user) {
        throw new ForbiddenException('Access denied');
      }

      if (requiredRole === UserRole.NORMAL_USER && user.role !== UserRole.NORMAL_USER) {
        throw new ForbiddenException('Only normal users can perform this action');
      }

      if (requiredRole === UserRole.AGENCY_MANAGER && user.role !== UserRole.AGENCY_MANAGER && user.role !== UserRole.GENERAL_MANAGER) {
        throw new ForbiddenException('Only agency managers or general managers can perform this action');
      }
    }

    return agency;
  }

  private async getTicketWithAccess(ticketId: string, agencyId: string, userId?: string, checkOwnership: boolean = true) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        agencyId: agencyId,
      },
      include: {
        invoice: {
          select: { invoiceNumber: true, status: true },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${ticketId} not found in this agency`);
    }

    if (checkOwnership && userId && ticket.userId !== userId) {
      throw new ForbiddenException('You can only access your own tickets');
    }

    return ticket;
  }

  // ============ Normal User Methods ============

  async create(agencyId: string, userId: string, dto: CreateTicketDto) {
    await this.validateAgencyAccess(agencyId, userId, UserRole.NORMAL_USER);

    // Check plan limit for tickets per month
    await this.plansService.checkTicketLimit(agencyId);

    // Check if ticket number already exists in this agency
    const existingTicket = await this.prisma.ticket.findFirst({
      where: {
        agencyId: agencyId,
        ticketNumber: dto.ticketNumber,
      },
    });

    if (existingTicket) {
      throw new BadRequestException(`Ticket number ${dto.ticketNumber} already exists in this agency`);
    }

    const ticket = await this.prisma.ticket.create({
      data: {
        ticketNumber: dto.ticketNumber,
        referenceNumber: dto.referenceNumber,
        agencyId: agencyId,
        userId: userId,
        passengerName: this.sanitizeString(dto.passengerName),
        passengerPhone: this.sanitizeString(dto.passengerPhone),
        flightNumber: this.sanitizeString(dto.flightNumber),
        origin: this.sanitizeString(dto.origin),
        destination: this.sanitizeString(dto.destination),
        flightDate: new Date(dto.flightDate),
        seatClass: this.sanitizeString(dto.seatClass),
        price: dto.price,
        status: TicketStatus.DRAFT,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'CREATE_TICKET',
        entityType: 'Ticket',
        entityId: ticket.id,
        newData: { ticketNumber: dto.ticketNumber },
      },
    });

    return ticket;
  }

  async findAll(
    agencyId: string,
    userId: string,
    userRole: UserRole,
    page: number = 1,
    limit: number = 20,
    status?: TicketStatus,
    search?: string,
  ) {
    await this.validateAgencyAccess(agencyId, userId);

    const skip = (page - 1) * limit;
    
    const where: any = {
      agencyId: agencyId,
    };

    if (userRole === UserRole.NORMAL_USER) {
      where.userId = userId;
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      const sanitizedSearch = this.sanitizeString(search);
      where.OR = [
        { ticketNumber: { contains: sanitizedSearch, mode: 'insensitive' } },
        { passengerName: { contains: sanitizedSearch, mode: 'insensitive' } },
        { passengerPhone: { contains: sanitizedSearch, mode: 'insensitive' } },
        { flightNumber: { contains: sanitizedSearch, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where,
        skip,
        take: limit > 100 ? 100 : limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.ticket.count({ where }),
    ]);

    return {
      data: tickets,
      meta: {
        page,
        limit: limit > 100 ? 100 : limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(agencyId: string, userId: string, userRole: UserRole, ticketId: string) {
    await this.validateAgencyAccess(agencyId, userId);

    const where: any = {
      id: ticketId,
      agencyId: agencyId,
    };

    if (userRole === UserRole.NORMAL_USER) {
      where.userId = userId;
    }

    const ticket = await this.prisma.ticket.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            status: true,
            total: true,
          },
        },
        penalties: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  async update(agencyId: string, userId: string, userRole: UserRole, ticketId: string, dto: UpdateTicketDto) {
    const ticket = await this.getTicketWithAccess(ticketId, agencyId, userId, userRole === UserRole.NORMAL_USER);

    if (ticket.status === TicketStatus.INVOICED) {
      throw new BadRequestException('Cannot edit a ticket that has been invoiced');
    }

    if (ticket.status === TicketStatus.FINALIZED && userRole === UserRole.NORMAL_USER) {
      throw new BadRequestException('Cannot edit a finalized ticket. Please request unlock from agency manager.');
    }

    let newStatus = dto.status;
    if (dto.status === TicketStatus.FINALIZED && userRole === UserRole.NORMAL_USER) {
      if (ticket.status !== TicketStatus.COMPLETED) {
        throw new BadRequestException('Ticket must be completed before finalization');
      }
      newStatus = TicketStatus.FINALIZED;
    }

    if (dto.status === TicketStatus.COMPLETED) {
      const requiredFields = ['passengerName', 'passengerPhone', 'flightNumber', 'origin', 'destination', 'flightDate', 'seatClass', 'price'];
      for (const field of requiredFields) {
        const value = (dto as any)[field] ?? (ticket as any)[field];
        if (!value) {
          throw new BadRequestException(`Field ${field} is required to complete the ticket`);
        }
      }
    }

    const updateData: any = {
      ticketNumber: dto.ticketNumber ? this.sanitizeString(dto.ticketNumber) : undefined,
      referenceNumber: dto.referenceNumber ? this.sanitizeString(dto.referenceNumber) : undefined,
      passengerName: dto.passengerName ? this.sanitizeString(dto.passengerName) : undefined,
      passengerPhone: dto.passengerPhone ? this.sanitizeString(dto.passengerPhone) : undefined,
      flightNumber: dto.flightNumber ? this.sanitizeString(dto.flightNumber) : undefined,
      origin: dto.origin ? this.sanitizeString(dto.origin) : undefined,
      destination: dto.destination ? this.sanitizeString(dto.destination) : undefined,
      seatClass: dto.seatClass ? this.sanitizeString(dto.seatClass) : undefined,
      price: dto.price,
      status: newStatus,
    };

    if (dto.flightDate) {
      updateData.flightDate = new Date(dto.flightDate);
    }

    if (newStatus === TicketStatus.FINALIZED && ticket.status !== TicketStatus.FINALIZED) {
      updateData.finalizedAt = new Date();
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
    });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'UPDATE_TICKET',
        entityType: 'Ticket',
        entityId: ticketId,
        oldData: { oldStatus: ticket.status },
        newData: { newStatus: updatedTicket.status },
      },
    });

    return updatedTicket;
  }

  async delete(agencyId: string, userId: string, userRole: UserRole, ticketId: string) {
    const ticket = await this.getTicketWithAccess(ticketId, agencyId, userId, userRole === UserRole.NORMAL_USER);

    if (ticket.status === TicketStatus.INVOICED) {
      throw new BadRequestException('Cannot delete a ticket that has been invoiced');
    }

    if (ticket.status === TicketStatus.FINALIZED) {
      throw new BadRequestException('Cannot delete a finalized ticket');
    }

    await this.prisma.ticket.delete({ where: { id: ticketId } });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'DELETE_TICKET',
        entityType: 'Ticket',
        entityId: ticketId,
      },
    });

    return { message: 'Ticket deleted successfully' };
  }

  // ============ Unlock Request Methods ============

  async requestUnlock(agencyId: string, userId: string, ticketId: string, dto: RequestUnlockTicketDto) {
    await this.validateAgencyAccess(agencyId, userId, UserRole.NORMAL_USER);
    const ticket = await this.getTicketWithAccess(ticketId, agencyId, userId, true);

    if (ticket.status !== TicketStatus.FINALIZED && ticket.status !== TicketStatus.INVOICED) {
      throw new BadRequestException('Only finalized or invoiced tickets need unlock request');
    }

    const existingRequest = await this.prisma.supportTicket.findFirst({
      where: {
        agencyId: agencyId,
        senderType: 'AGENCY',
        title: `درخواست باز کردن بلیط ${ticket.ticketNumber}`,
        status: 'OPEN',
      },
    });

    if (existingRequest) {
      throw new BadRequestException('You already have a pending unlock request for this ticket');
    }

    const sanitizedReason = this.sanitizeString(dto.reason);
    const unlockTicket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber: `UNLOCK-${Date.now()}`,
        title: `درخواست باز کردن بلیط ${ticket.ticketNumber}`,
        description: `دلیل درخواست: ${sanitizedReason}\n\nشماره بلیط: ${ticket.ticketNumber}\nمسافر: ${ticket.passengerName}\nپرواز: ${ticket.flightNumber}`,
        status: 'OPEN',
        priority: 'MEDIUM',
        senderType: 'AGENCY',
        agencyId: agencyId,
        userId: userId,
        forwardedTo: 'AGENCY_MANAGER',
      },
    });

    await this.prisma.penalty.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        points: 1,
        reason: `UNLOCK_FROZEN_TICKET - Ticket: ${ticket.ticketNumber}`,
        ticketId: ticketId,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'REQUEST_UNLOCK_TICKET',
        entityType: 'Ticket',
        entityId: ticketId,
        newData: { reason: sanitizedReason },
      },
    });

    return {
      message: 'Unlock request submitted successfully. A penalty point has been recorded.',
      supportTicket: unlockTicket,
    };
  }

  async getUnlockRequests(agencyId: string, userId: string, userRole: UserRole) {
    await this.validateAgencyAccess(agencyId, userId);

    if (userRole !== UserRole.AGENCY_MANAGER && userRole !== UserRole.GENERAL_MANAGER) {
      throw new ForbiddenException('Only agency managers can view unlock requests');
    }

    const requests = await this.prisma.supportTicket.findMany({
      where: {
        agencyId: agencyId,
        forwardedTo: 'AGENCY_MANAGER',
        status: 'OPEN',
        title: { startsWith: 'درخواست باز کردن بلیط' },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return requests;
  }

  async processUnlockRequest(agencyId: string, managerId: string, requestId: string, dto: ProcessUnlockRequestDto) {
    await this.validateAgencyAccess(agencyId, managerId);
    
    const request = await this.prisma.supportTicket.findFirst({
      where: {
        id: requestId,
        agencyId: agencyId,
        forwardedTo: 'AGENCY_MANAGER',
      },
    });

    if (!request) {
      throw new NotFoundException('Unlock request not found');
    }

    const ticketNumberMatch = request.title.match(/بلیط\s+(\S+)/);
    if (!ticketNumberMatch) {
      throw new BadRequestException('Could not find ticket number in request');
    }

    const ticketNumber = ticketNumberMatch[1];
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        agencyId: agencyId,
        ticketNumber: ticketNumber,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Associated ticket not found');
    }

    if (dto.action === UnlockRequestAction.APPROVE) {
      await this.prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.COMPLETED,
          finalizedAt: null,
        },
      });

      await this.prisma.supportTicket.update({
        where: { id: requestId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });

      await this.prisma.activityLog.create({
        data: {
          userId: managerId,
          agencyId: agencyId,
          action: 'APPROVE_UNLOCK_TICKET',
          entityType: 'Ticket',
          entityId: ticket.id,
        },
      });

      return { message: 'Ticket unlocked successfully. User can now edit the ticket.' };
    } else {
      await this.prisma.supportTicket.update({
        where: { id: requestId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
      });

      await this.prisma.activityLog.create({
        data: {
          userId: managerId,
          agencyId: agencyId,
          action: 'REJECT_UNLOCK_TICKET',
          entityType: 'Ticket',
          entityId: ticket.id,
          newData: { notes: dto.notes ? this.sanitizeString(dto.notes) : null },
        },
      });

      return { message: 'Unlock request rejected. Ticket remains locked.' };
    }
  }

  // ============ General Manager Methods ============

  async forceUnlockTicket(agencyId: string, managerId: string, ticketId: string) {
    await this.validateAgencyAccess(agencyId, managerId);
    
    const user = await this.prisma.user.findFirst({
      where: { id: managerId, agencyId: agencyId },
    });

    if (user?.role !== UserRole.GENERAL_MANAGER) {
      throw new ForbiddenException('Only General Manager can force unlock tickets');
    }

    const ticket = await this.getTicketWithAccess(ticketId, agencyId, undefined, false);

    if (ticket.status !== TicketStatus.FINALIZED && ticket.status !== TicketStatus.INVOICED) {
      throw new BadRequestException('Ticket is not in a locked state');
    }

    const updatedTicket = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: TicketStatus.COMPLETED,
        finalizedAt: null,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: managerId,
        agencyId: agencyId,
        action: 'FORCE_UNLOCK_TICKET',
        entityType: 'Ticket',
        entityId: ticketId,
      },
    });

    return {
      message: 'Ticket forcefully unlocked by General Manager',
      ticket: updatedTicket,
    };
  }

  // ============ Security Helper ============

  private sanitizeString(input: string): string {
    if (!input) return input;
    return input.trim().replace(/[<>]/g, '');
  }
}