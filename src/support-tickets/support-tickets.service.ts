import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { 
  CreateSupportTicketDto, 
  ReplyToTicketDto, 
  ForwardTicketDto, 
  ForwardTarget,
  UpdateTicketStatusDto 
} from './dto';
import { SupportTicketStatus, SupportTicketPriority, UserRole, UserStatus } from '@prisma/client';

@Injectable()
export class SupportTicketsService {
  constructor(private prisma: PrismaService) {}

  // ============ Helper Methods ============

  private async generateTicketNumber(): Promise<string> {
    const lastTicket = await this.prisma.supportTicket.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { ticketNumber: true },
    });

    let sequence = 1;
    if (lastTicket && lastTicket.ticketNumber) {
      const match = lastTicket.ticketNumber.match(/TKT-(\d+)/);
      if (match) {
        sequence = parseInt(match[1]) + 1;
      }
    }

    return `TKT-${sequence.toString().padStart(6, '0')}`;
  }

  private async validateTicketAccess(
    ticketId: string, 
    userId: string, 
    userRole: UserRole, 
    agencyId?: string | null, 
    organizationId?: string | null
  ) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        agency: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        parentTicket: { select: { id: true, ticketNumber: true } },
        childTickets: {
          select: {
            id: true,
            ticketNumber: true,
            title: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    // Super Admin can access all tickets
    if (userRole === UserRole.SUPER_ADMIN) {
      return ticket;
    }

    // Agency users
    if (ticket.senderType === 'AGENCY' && agencyId) {
      if (ticket.agencyId !== agencyId) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
      
      const user = await this.prisma.user.findFirst({
        where: { id: userId, agencyId: agencyId, status: UserStatus.ACTIVE },
      });

      if (!user) {
        throw new ForbiddenException('Access denied');
      }

      // Normal user can only see their own tickets
      if (userRole === UserRole.NORMAL_USER && ticket.userId !== userId) {
        throw new ForbiddenException('You can only view your own tickets');
      }

      return ticket;
    }

    // Organization users
    if (ticket.senderType === 'ORGANIZATION' && organizationId) {
      if (ticket.organizationId !== organizationId) {
        throw new ForbiddenException('You do not have access to this ticket');
      }
      return ticket;
    }

    throw new ForbiddenException('You do not have access to this ticket');
  }

  // ============ Create Ticket ============

  async createTicket(
    userId: string,
    userRole: UserRole,
    agencyId: string | null,
    organizationId: string | null,
    dto: CreateSupportTicketDto,
  ) {
    let senderType: string;
    let targetAgencyId: string | undefined = undefined;
    let targetOrganizationId: string | undefined = undefined;
    let forwardedTo: string | null = null;

    if (agencyId) {
      senderType = 'AGENCY';
      targetAgencyId = agencyId;
      
      if (userRole === UserRole.NORMAL_USER) {
        forwardedTo = 'AGENCY_MANAGER';
      } else if (userRole === UserRole.AGENCY_MANAGER) {
        forwardedTo = 'GENERAL_MANAGER';
      } else if (userRole === UserRole.GENERAL_MANAGER) {
        forwardedTo = 'SUPPORT';
      }
    } else if (organizationId) {
      senderType = 'ORGANIZATION';
      targetOrganizationId = organizationId;
      forwardedTo = 'SUPPORT';
    } else {
      throw new BadRequestException('Either agencyId or organizationId is required');
    }

    const ticketNumber = await this.generateTicketNumber();

    let parentTicketId: string | null = null;
    if (dto.parentTicketId) {
      const parentTicket = await this.prisma.supportTicket.findUnique({
        where: { id: dto.parentTicketId },
      });
      if (!parentTicket) {
        throw new NotFoundException('Parent ticket not found');
      }
      parentTicketId = dto.parentTicketId;
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        title: dto.title,
        description: dto.description,
        priority: dto.priority || SupportTicketPriority.MEDIUM,
        status: SupportTicketStatus.OPEN,
        senderType,
        agencyId: targetAgencyId,
        organizationId: targetOrganizationId,
        userId,
        forwardedTo,
        parentTicketId: parentTicketId as string | undefined,
      },
      include: {
        agency: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        agencyId: targetAgencyId,
        organizationId: targetOrganizationId,
        action: 'CREATE_SUPPORT_TICKET',
        entityType: 'SupportTicket',
        entityId: ticket.id,
        newData: { ticketNumber, title: dto.title },
      },
    });

    return ticket;
  }

  // ============ Get Tickets ============

  async getMyTickets(
    userId: string,
    userRole: UserRole,
    agencyId: string | null,
    organizationId: string | null,
    page: number = 1,
    limit: number = 20,
    status?: SupportTicketStatus,
  ) {
    const skip = (page - 1) * limit;
    
    const where: any = {};

    if (agencyId) {
      where.agencyId = agencyId;
      where.senderType = 'AGENCY';
      
      if (userRole === UserRole.NORMAL_USER) {
        where.userId = userId;
      }
    } else if (organizationId) {
      where.organizationId = organizationId;
      where.senderType = 'ORGANIZATION';
    } else if (userRole === UserRole.SUPER_ADMIN) {
      // Super admin sees all
    } else {
      throw new BadRequestException('No agency or organization context');
    }

    if (status) {
      where.status = status;
    }

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
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
          agency: { select: { name: true } },
          organization: { select: { name: true } },
          replies: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: { firstName: true, lastName: true, role: true },
              },
            },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      data: tickets,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTicket(
    ticketId: string,
    userId: string,
    userRole: UserRole,
    agencyId: string | null,
    organizationId: string | null,
  ) {
    return this.validateTicketAccess(ticketId, userId, userRole, agencyId, organizationId);
  }

  // ============ Reply to Ticket (اصلاح شده) ============

  async replyToTicket(
    ticketId: string,
    userId: string,
    userRole: UserRole,
    agencyId: string | null,
    organizationId: string | null,
    dto: ReplyToTicketDto,
  ) {
    const ticket = await this.validateTicketAccess(ticketId, userId, userRole, agencyId, organizationId);

    if (ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED) {
      throw new BadRequestException('Cannot reply to a closed or resolved ticket');
    }

    // بررسی دسترسی برای پاسخ بر اساس forwardedTo
    if (userRole === UserRole.NORMAL_USER && ticket.userId !== userId) {
      throw new ForbiddenException('You can only reply to your own tickets');
    }

    if (userRole === UserRole.AGENCY_MANAGER && ticket.forwardedTo !== 'AGENCY_MANAGER') {
      throw new ForbiddenException('You can only reply to tickets forwarded to you');
    }

    if (userRole === UserRole.GENERAL_MANAGER) {
      if (ticket.forwardedTo === 'GENERAL_MANAGER') {
      } 
      else if (ticket.forwardedTo === 'SUPPORT' && ticket.agencyId === agencyId) {
      }
      else {
        throw new ForbiddenException('شما فقط می‌توانید به تیکت‌های ارجاع شده به خودتان پاسخ دهید');
      }
    }

    const reply = await this.prisma.supportTicketReply.create({
      data: {
        ticketId,
        userId,
        message: dto.message,
        isInternal: dto.isInternal || false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    if (ticket.status === SupportTicketStatus.OPEN) {
      await this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: { status: SupportTicketStatus.IN_PROGRESS },
      });
    }

    await this.prisma.activityLog.create({
      data: {
        userId,
        agencyId: ticket.agencyId,
        organizationId: ticket.organizationId,
        action: 'REPLY_TO_SUPPORT_TICKET',
        entityType: 'SupportTicketReply',
        entityId: reply.id,
        newData: { ticketId, isInternal: dto.isInternal },
      },
    });

    return reply;
  }

  // ============ Forward Ticket (اصلاح شده) ============

  async forwardTicket(
    ticketId: string,
    userId: string,
    userRole: UserRole,
    agencyId: string | null,
    dto: ForwardTicketDto,
  ) {
    const ticket = await this.validateTicketAccess(ticketId, userId, userRole, agencyId, null);

    if (ticket.senderType !== 'AGENCY') {
      throw new BadRequestException('Only agency tickets can be forwarded');
    }

    if (ticket.status === SupportTicketStatus.CLOSED || ticket.status === SupportTicketStatus.RESOLVED) {
      throw new BadRequestException('Cannot forward a closed or resolved ticket');
    }

    // بررسی دسترسی برای ارجاع بر اساس forwardedTo
    if (userRole === UserRole.NORMAL_USER) {
      if (ticket.forwardedTo !== 'AGENCY_MANAGER') {
        throw new ForbiddenException('You can only forward tickets that are forwarded to Agency Manager');
      }
      if (dto.forwardTo !== 'AGENCY_MANAGER') {
        throw new ForbiddenException('Normal user can only forward to Agency Manager');
      }
    }
    
    if (userRole === UserRole.AGENCY_MANAGER) {
      if (ticket.forwardedTo !== 'GENERAL_MANAGER') {
        throw new ForbiddenException('You can only forward tickets that are forwarded to General Manager');
      }
      if (dto.forwardTo !== 'GENERAL_MANAGER') {
        throw new ForbiddenException('Agency Manager can only forward to General Manager');
      }
    }
    
    if (userRole === UserRole.GENERAL_MANAGER) {
      if (ticket.forwardedTo !== 'GENERAL_MANAGER' && ticket.forwardedTo !== 'SUPPORT') {
        throw new ForbiddenException('You can only forward tickets that are forwarded to you');
      }
      if (dto.forwardTo !== 'SUPPORT') {
        throw new ForbiddenException('General Manager can only forward to Support');
      }
    }

    const newTicketNumber = await this.generateTicketNumber();
    
    const forwardedTicket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber: newTicketNumber,
        title: `[Forwarded] ${ticket.title}`,
        description: `${ticket.description}\n\n---\nForwarded by: ${ticket.user.firstName} ${ticket.user.lastName}\nNotes: ${dto.notes || 'No additional notes'}`,
        priority: ticket.priority,
        status: SupportTicketStatus.OPEN,
        senderType: 'AGENCY',
        agencyId: ticket.agencyId,
        userId: ticket.userId,
        forwardedTo: dto.forwardTo,
        parentTicketId: ticketId,
      },
    });

    await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: SupportTicketStatus.FORWARDED },
    });

    await this.prisma.supportTicketReply.create({
      data: {
        ticketId,
        userId,
        message: `این تیکت به ${dto.forwardTo} ارجاع داده شد. شماره تیکت جدید: ${newTicketNumber}`,
        isInternal: true,
      },
    });

    await this.prisma.activityLog.create({
      data: {
        userId,
        agencyId: ticket.agencyId,
        action: 'FORWARD_SUPPORT_TICKET',
        entityType: 'SupportTicket',
        entityId: ticketId,
        newData: { forwardedTo: dto.forwardTo, newTicketId: forwardedTicket.id },
      },
    });

    return {
      message: `Ticket forwarded to ${dto.forwardTo}`,
      originalTicket: ticket,
      forwardedTicket,
    };
  }

  // ============ Update Status (Admin/Super Admin) ============

  async updateTicketStatus(
    ticketId: string,
    userId: string,
    dto: UpdateTicketStatusDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: UserRole.SUPER_ADMIN, status: UserStatus.ACTIVE },
    });

    if (!user) {
      throw new ForbiddenException('Only Super Admin can update ticket status');
    }

    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const updatedTicket = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: dto.status,
        resolvedAt: dto.status === SupportTicketStatus.RESOLVED ? new Date() : null,
      },
    });

    await this.prisma.supportTicketReply.create({
      data: {
        ticketId,
        userId,
        message: `وضعیت تیکت به ${dto.status} تغییر یافت. ${dto.notes ? `توضیحات: ${dto.notes}` : ''}`,
        isInternal: true,
      },
    });

    return updatedTicket;
  }

  // ============ Super Admin Methods ============

  async getAllTickets(
    page: number = 1,
    limit: number = 20,
    status?: SupportTicketStatus,
    senderType?: string,
    priority?: SupportTicketPriority,
  ) {
    const skip = (page - 1) * limit;
    
    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (senderType) {
      where.senderType = senderType;
    }
    if (priority) {
      where.priority = priority;
    }

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
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
          agency: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true } },
          replies: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      data: tickets,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTicketStats() {
    const stats = await this.prisma.supportTicket.groupBy({
      by: ['status', 'senderType'],
      _count: true,
    });

    const total = await this.prisma.supportTicket.count();

    return {
      total,
      breakdown: stats,
    };
  }
}