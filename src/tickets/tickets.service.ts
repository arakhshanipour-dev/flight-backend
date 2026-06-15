import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { CreateTicketDto, UpdateTicketDto, RequestUnlockTicketDto, ProcessUnlockRequestDto, UnlockRequestAction } from './dto';
import { TicketStatus, UserRole, UserStatus, AgencyStatus, SupportTicketStatus } from '@prisma/client';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private plansService: PlansService,
  ) {}

  private async validateAgencyAccess(agencyId: string, userId: string, requiredRole?: UserRole) {
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency) {
      throw new NotFoundException('آژانس مورد نظر یافت نشد');
    }

    if (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL) {
      throw new ForbiddenException('آژانس فعال نیست');
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
        throw new ForbiddenException('دسترسی denied');
      }

      if (requiredRole === UserRole.NORMAL_USER && user.role !== UserRole.NORMAL_USER) {
        throw new ForbiddenException('این action فقط برای کاربران عادی مجاز است');
      }

      if (requiredRole === UserRole.AGENCY_MANAGER && user.role !== UserRole.AGENCY_MANAGER && user.role !== UserRole.GENERAL_MANAGER) {
        throw new ForbiddenException('این action فقط برای مدیران آژانس یا مدیر کل مجاز است');
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
      throw new NotFoundException(`بلیط با شناسه ${ticketId} در این آژانس یافت نشد`);
    }

    if (checkOwnership && userId && ticket.userId !== userId) {
      throw new ForbiddenException('شما فقط می‌توانید به بلیط‌های خود دسترسی داشته باشید');
    }

    return ticket;
  }

  private checkRequiredFields(ticket: any, dto: UpdateTicketDto): string[] {
    const missingFields: string[] = [];
    if (!ticket.passengerName && !dto.passengerName) missingFields.push('نام مسافر');
    if (!ticket.passengerPhone && !dto.passengerPhone) missingFields.push('شماره تماس');
    if (!ticket.flightNumber && !dto.flightNumber) missingFields.push('شماره پرواز');
    if (!ticket.origin && !dto.origin) missingFields.push('مبدأ');
    if (!ticket.destination && !dto.destination) missingFields.push('مقصد');
    if (!ticket.flightDate && !dto.flightDate) missingFields.push('تاریخ پرواز');
    if (!ticket.seatClass && !dto.seatClass) missingFields.push('کلاس پرواز');
    if ((!ticket.price || ticket.price === 0) && (!dto.price || dto.price === 0)) missingFields.push('قیمت');
    return missingFields;
  }

  private sanitizeString(input: string): string {
    if (!input) return input;
    return input.trim().replace(/[<>]/g, '');
  }

  async create(agencyId: string, userId: string, dto: CreateTicketDto) {
    await this.validateAgencyAccess(agencyId, userId, UserRole.NORMAL_USER);
    await this.plansService.checkTicketLimit(agencyId);

    const existingTicket = await this.prisma.ticket.findFirst({
      where: {
        agencyId: agencyId,
        ticketNumber: dto.ticketNumber,
      },
    });

    if (existingTicket) {
      throw new BadRequestException(`❌ شماره بلیط ${dto.ticketNumber} قبلاً در این آژانس ثبت شده است`);
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
      throw new NotFoundException('بلیط مورد نظر یافت نشد');
    }

    return ticket;
  }

  async update(agencyId: string, userId: string, userRole: UserRole, ticketId: string, dto: UpdateTicketDto) {
    const ticket = await this.getTicketWithAccess(ticketId, agencyId, userId, userRole === UserRole.NORMAL_USER);

    if (ticket.status === TicketStatus.INVOICED) {
      throw new BadRequestException('❌ این بلیط قبلاً فاکتور شده است و قابل ویرایش نیست');
    }

    if (ticket.status === TicketStatus.FINALIZED && userRole === UserRole.NORMAL_USER) {
      throw new BadRequestException('❌ این بلیط نهایی شده است. برای ویرایش، ابتدا درخواست باز کردن بلیط را ثبت کنید');
    }

    let newStatus = dto.status || ticket.status;

    if (userRole === UserRole.NORMAL_USER) {
      if (dto.status === TicketStatus.COMPLETED) {
        const missingFields = this.checkRequiredFields(ticket, dto);
        if (missingFields.length > 0) {
          throw new BadRequestException(`⚠️ برای تکمیل بلیط، فیلدهای زیر باید پر شوند:\n${missingFields.join('، ')}`);
        }
        newStatus = TicketStatus.COMPLETED;
      } 
      else if (dto.status === TicketStatus.FINALIZED) {
        if (ticket.status !== TicketStatus.COMPLETED) {
          throw new BadRequestException('⚠️ بلیط ابتدا باید تکمیل شود (وضعیت COMPLETED)، سپس می‌توانید آن را نهایی کنید');
        }
        newStatus = TicketStatus.FINALIZED;
      }
      else if (dto.status && dto.status !== ticket.status) {
        throw new BadRequestException('❌ شما فقط می‌توانید وضعیت بلیط را به "تکمیل شده" یا "نهایی شده" تغییر دهید');
      }
    }

    if (userRole !== UserRole.NORMAL_USER && dto.status === TicketStatus.FINALIZED) {
      if (ticket.status !== TicketStatus.COMPLETED && ticket.status !== TicketStatus.FINALIZED) {
        throw new BadRequestException('⚠️ بلیط باید در وضعیت COMPLETED باشد تا بتوان آن را نهایی کرد');
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
      throw new BadRequestException('❌ این بلیط قبلاً فاکتور شده است و قابل حذف نیست');
    }

    if (ticket.status === TicketStatus.FINALIZED) {
      throw new BadRequestException('❌ این بلیط نهایی شده است و قابل حذف نیست');
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

    return { message: '✅ بلیط با موفقیت حذف شد' };
  }

  // ============ درخواست باز کردن بلیط (اصلاح شده - پشتیبانی از زنجیره ارجاع) ============

  async requestUnlock(agencyId: string, userId: string, ticketId: string, dto: RequestUnlockTicketDto) {
    await this.validateAgencyAccess(agencyId, userId, UserRole.NORMAL_USER);
    const ticket = await this.getTicketWithAccess(ticketId, agencyId, userId, true);

    if (ticket.status !== TicketStatus.FINALIZED && ticket.status !== TicketStatus.INVOICED) {
      throw new BadRequestException('⚠️ فقط بلیط‌های نهایی شده یا فاکتور شده نیاز به درخواست باز کردن دارند');
    }

    // بررسی درخواست قبلی باز (در هر وضعیتی غیر از RESOLVED یا CLOSED)
    const existingRequest = await this.prisma.supportTicket.findFirst({
      where: {
        agencyId: agencyId,
        senderType: 'AGENCY',
        title: { startsWith: `درخواست باز کردن بلیط ${ticket.ticketNumber}` },
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.FORWARDED] },
      },
    });

    if (existingRequest) {
      throw new BadRequestException('⚠️ شما قبلاً یک درخواست باز کردن برای این بلیط ثبت کرده‌اید که همچنان باز است');
    }

    const sanitizedReason = this.sanitizeString(dto.reason);
    
    // تعیین مرجع مقصد بر اساس نقش کاربر
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    let forwardedTo = 'AGENCY_MANAGER';
    
    if (user?.role === UserRole.AGENCY_MANAGER) {
      forwardedTo = 'GENERAL_MANAGER';
    } else if (user?.role === UserRole.GENERAL_MANAGER) {
      forwardedTo = 'SUPPORT';
    }

    const unlockTicket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber: `UNLOCK-${Date.now()}`,
        title: `درخواست باز کردن بلیط ${ticket.ticketNumber}`,
        description: `دلیل درخواست: ${sanitizedReason}\n\nشماره بلیط: ${ticket.ticketNumber}\nمسافر: ${ticket.passengerName}\nپرواز: ${ticket.flightNumber}\nوضعیت فعلی: ${ticket.status}`,
        status: SupportTicketStatus.OPEN,
        priority: 'MEDIUM',
        senderType: 'AGENCY',
        agencyId: agencyId,
        userId: userId,
        forwardedTo: forwardedTo,
      },
    });

    // ثبت امتیاز منفی فقط برای کاربر عادی
    if (user?.role === UserRole.NORMAL_USER) {
      await this.prisma.penalty.create({
        data: {
          userId: userId,
          agencyId: agencyId,
          points: 1,
          reason: `درخواست باز کردن بلیط ${ticket.ticketNumber}`,
          ticketId: ticketId,
        },
      });
    }

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'REQUEST_UNLOCK_TICKET',
        entityType: 'Ticket',
        entityId: ticketId,
        newData: { reason: sanitizedReason, forwardedTo },
      },
    });

    const targetLabel = forwardedTo === 'AGENCY_MANAGER' ? 'مدیر آژانس' : forwardedTo === 'GENERAL_MANAGER' ? 'مدیر کل' : 'پشتیبانی';
    
    return {
      message: `✅ درخواست باز کردن بلیط با موفقیت ثبت شد. درخواست به ${targetLabel} ارسال شد.${user?.role === UserRole.NORMAL_USER ? ' یک امتیاز منفی برای شما ثبت گردید.' : ''}`,
      supportTicket: unlockTicket,
    };
  }

  // ============ دریافت درخواست‌های باز کردن (بر اساس نقش) ============

  async getUnlockRequests(agencyId: string, userId: string, userRole: UserRole) {
    await this.validateAgencyAccess(agencyId, userId);

    let forwardedTo: string | undefined;
    
    if (userRole === UserRole.AGENCY_MANAGER) {
      forwardedTo = 'AGENCY_MANAGER';
    } else if (userRole === UserRole.GENERAL_MANAGER) {
      forwardedTo = 'GENERAL_MANAGER';
    } else {
      throw new ForbiddenException('❌ فقط مدیران آژانس یا مدیر کل می‌توانند درخواست‌های باز کردن را مشاهده کنند');
    }

    const requests = await this.prisma.supportTicket.findMany({
      where: {
        agencyId: agencyId,
        forwardedTo: forwardedTo,
        status: SupportTicketStatus.OPEN,
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

  // ============ پردازش درخواست باز کردن (تأیید/رد) ============

  async processUnlockRequest(agencyId: string, managerId: string, requestId: string, dto: ProcessUnlockRequestDto) {
    await this.validateAgencyAccess(agencyId, managerId);
    
    const request = await this.prisma.supportTicket.findFirst({
      where: {
        id: requestId,
        agencyId: agencyId,
        status: SupportTicketStatus.OPEN,
        title: { startsWith: 'درخواست باز کردن بلیط' },
      },
    });

    if (!request) {
      throw new NotFoundException('درخواست باز کردن بلیط یافت نشد');
    }

    // بررسی دسترسی (مدیر آژانس یا مدیر کل)
    const user = await this.prisma.user.findUnique({ where: { id: managerId } });
    
    if (user?.role === UserRole.AGENCY_MANAGER && request.forwardedTo !== 'AGENCY_MANAGER') {
      throw new ForbiddenException('شما مجاز به پردازش این درخواست نیستید');
    }
    
    if (user?.role === UserRole.GENERAL_MANAGER && request.forwardedTo !== 'GENERAL_MANAGER') {
      throw new ForbiddenException('شما مجاز به پردازش این درخواست نیستید');
    }

    const ticketNumberMatch = request.title.match(/بلیط\s+(\S+)/);
    if (!ticketNumberMatch) {
      throw new BadRequestException('شماره بلیط در درخواست یافت نشد');
    }

    const ticketNumber = ticketNumberMatch[1];
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        agencyId: agencyId,
        ticketNumber: ticketNumber,
      },
    });

    if (!ticket) {
      throw new NotFoundException('بلیط مرتبط با این درخواست یافت نشد');
    }

    if (dto.action === UnlockRequestAction.APPROVE) {
      // باز کردن بلیط
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
          status: SupportTicketStatus.RESOLVED,
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
          newData: { approvedBy: user?.role },
        },
      });

      return { message: '✅ بلیط با موفقیت باز شد. کاربر می‌تواند بلیط را ویرایش کند.' };
    } 
    else {
      // رد درخواست
      await this.prisma.supportTicket.update({
        where: { id: requestId },
        data: {
          status: SupportTicketStatus.RESOLVED,
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
          newData: { notes: dto.notes ? this.sanitizeString(dto.notes) : null, rejectedBy: user?.role },
        },
      });

      return { message: '❌ درخواست باز کردن بلیط رد شد. بلیط همچنان قفل است.' };
    }
  }

  // ============ باز کردن اجباری توسط مدیر کل ============

  async forceUnlockTicket(agencyId: string, managerId: string, ticketId: string) {
    await this.validateAgencyAccess(agencyId, managerId);
    
    const user = await this.prisma.user.findFirst({
      where: { id: managerId, agencyId: agencyId },
    });

    if (user?.role !== UserRole.GENERAL_MANAGER) {
      throw new ForbiddenException('❌ فقط مدیر کل می‌تواند بلیط را به اجبار باز کند');
    }

    const ticket = await this.getTicketWithAccess(ticketId, agencyId, undefined, false);

    if (ticket.status !== TicketStatus.FINALIZED && ticket.status !== TicketStatus.INVOICED) {
      throw new BadRequestException('⚠️ بلیط در وضعیت قفل شده نیست');
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
      message: '🔓 بلیط به اجبار توسط مدیر کل باز شد',
      ticket: updatedTicket,
    };
  }
}