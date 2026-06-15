import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBankCardDto, UpdateBankCardDto } from './dto';
import { BankCardStatus, AgencyStatus, UserRole } from '@prisma/client';
import * as crypto from 'crypto';

@Injectable()
export class BankCardsService {
  constructor(private prisma: PrismaService) {}

  // ============ Helper Methods ============

  /**
   * Tokenize card number (در محیط واقعی باید از سرویس PSP استفاده شود)
   * اینجا برای نمونه از یک هش ساده استفاده می‌کنیم
   */
  private tokenizeCardNumber(cardNumber: string): string {
    const hash = crypto.createHash('sha256').update(cardNumber).digest('hex');
    return `tok_${hash.substring(0, 32)}`;
  }

  /**
   * Mask card number for display (فقط ۴ رقم اول و آخر نمایش داده شود)
   */
  private maskCardNumber(cardNumber: string): string {
    if (!cardNumber || cardNumber.length < 16) return cardNumber;
    const first4 = cardNumber.substring(0, 4);
    const last4 = cardNumber.substring(12, 16);
    return `${first4}******${last4}`;
  }

  /**
   * اعتبارسنجی دسترسی مدیریت کارت (فقط مدیر کل)
   */
  private async validateGeneralManagerAccess(agencyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        role: UserRole.GENERAL_MANAGER,
        status: 'ACTIVE',
      },
    });

    if (!user) {
      throw new ForbiddenException('❌ فقط مدیر کل می‌تواند کارت‌های بانکی را مدیریت کند');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency || (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL)) {
      throw new ForbiddenException('❌ آژانس فعال نیست');
    }

    return user;
  }

  /**
   * اعتبارسنجی دسترسی خواندن کارت (مدیر کل و مدیر آژانس)
   */
  private async validateBankCardReadAccess(agencyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        agencyId: agencyId,
        status: 'ACTIVE',
        role: { in: [UserRole.GENERAL_MANAGER, UserRole.AGENCY_MANAGER] },
      },
    });

    if (!user) {
      throw new ForbiddenException('❌ شما دسترسی به این بخش را ندارید');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency || (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL)) {
      throw new ForbiddenException('❌ آژانس فعال نیست');
    }

    return user;
  }

  // ============ مدیریت کارت (فقط مدیر کل) ============

  async create(agencyId: string, userId: string, dto: CreateBankCardDto) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    // بررسی وجود کارت تکراری
    const tokenizedCard = this.tokenizeCardNumber(dto.cardNumber);
    
    const existingCard = await this.prisma.bankCard.findFirst({
      where: {
        agencyId: agencyId,
        cardNumber: tokenizedCard,
      },
    });

    if (existingCard) {
      throw new ConflictException('❌ این شماره کارت قبلاً در این آژانس ثبت شده است');
    }

    // اگر این کارت به عنوان پیش‌فرض انتخاب شده، سایر کارت‌ها را غیرپیش‌فرض کن
    if (dto.isDefault) {
      await this.prisma.bankCard.updateMany({
        where: { agencyId: agencyId },
        data: { isDefault: false },
      });
    } else {
      // اگر اولین کارت است، خودکار به عنوان پیش‌فرض تنظیم شود
      const cardCount = await this.prisma.bankCard.count({ where: { agencyId: agencyId } });
      if (cardCount === 0) {
        dto.isDefault = true;
      }
    }

    const bankCard = await this.prisma.bankCard.create({
      data: {
        agencyId: agencyId,
        cardNumber: tokenizedCard,
        bankName: dto.bankName,
        accountHolder: dto.accountHolder,
        sheba: dto.sheba,
        status: BankCardStatus.ACTIVE,
        isDefault: dto.isDefault || false,
      },
    });

    // ثبت لاگ
    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'CREATE_BANK_CARD',
        entityType: 'BankCard',
        entityId: bankCard.id,
        newData: { bankName: dto.bankName, isDefault: dto.isDefault },
      },
    });

    return {
      ...bankCard,
      maskedCardNumber: this.maskCardNumber(dto.cardNumber),
      cardNumber: undefined,
    };
  }

  async update(agencyId: string, userId: string, cardId: string, dto: UpdateBankCardDto) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: cardId,
        agencyId: agencyId,
      },
    });

    if (!bankCard) {
      throw new NotFoundException('❌ کارت بانکی مورد نظر یافت نشد');
    }

    // اگر کاربر می‌خواهد این کارت را به عنوان پیش‌فرض تنظیم کند
    if (dto.isDefault === true && !bankCard.isDefault) {
      await this.prisma.bankCard.updateMany({
        where: { agencyId: agencyId },
        data: { isDefault: false },
      });
    }

    const updateData: any = {
      bankName: dto.bankName,
      accountHolder: dto.accountHolder,
      sheba: dto.sheba,
      status: dto.status,
      isDefault: dto.isDefault,
    };

    if (dto.cardNumber) {
      updateData.cardNumber = this.tokenizeCardNumber(dto.cardNumber);
    }

    const updatedCard = await this.prisma.bankCard.update({
      where: { id: cardId },
      data: updateData,
    });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'UPDATE_BANK_CARD',
        entityType: 'BankCard',
        entityId: cardId,
        newData: { updatedFields: Object.keys(dto) },
      },
    });

    return updatedCard;
  }

  async changeStatus(agencyId: string, userId: string, cardId: string, status: BankCardStatus) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: cardId,
        agencyId: agencyId,
      },
    });

    if (!bankCard) {
      throw new NotFoundException('❌ کارت بانکی مورد نظر یافت نشد');
    }

    // جلوگیری از غیرفعال کردن تنها کارت فعال
    if (status === BankCardStatus.INACTIVE) {
      const activeCards = await this.prisma.bankCard.count({
        where: {
          agencyId: agencyId,
          status: BankCardStatus.ACTIVE,
          id: { not: cardId },
        },
      });

      if (activeCards === 0) {
        throw new BadRequestException('❌ نمی‌توانید تنها کارت فعال را غیرفعال کنید');
      }
    }

    const updatedCard = await this.prisma.bankCard.update({
      where: { id: cardId },
      data: { status },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: status === BankCardStatus.ACTIVE ? 'ACTIVATE_BANK_CARD' : 'DEACTIVATE_BANK_CARD',
        entityType: 'BankCard',
        entityId: cardId,
      },
    });

    return updatedCard;
  }

  async setDefault(agencyId: string, userId: string, cardId: string) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: cardId,
        agencyId: agencyId,
      },
    });

    if (!bankCard) {
      throw new NotFoundException('❌ کارت بانکی مورد نظر یافت نشد');
    }

    if (bankCard.status !== BankCardStatus.ACTIVE) {
      throw new BadRequestException('❌ نمی‌توانید کارت غیرفعال را به عنوان پیش‌فرض تنظیم کنید');
    }

    // حذف پیش‌فرض از همه کارت‌ها
    await this.prisma.bankCard.updateMany({
      where: { agencyId: agencyId },
      data: { isDefault: false },
    });

    // تنظیم این کارت به عنوان پیش‌فرض
    const updatedCard = await this.prisma.bankCard.update({
      where: { id: cardId },
      data: { isDefault: true },
    });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'SET_DEFAULT_BANK_CARD',
        entityType: 'BankCard',
        entityId: cardId,
      },
    });

    return updatedCard;
  }

  async delete(agencyId: string, userId: string, cardId: string) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: cardId,
        agencyId: agencyId,
      },
      include: {
        invoices: { take: 1, select: { id: true } },
        payments: { take: 1, select: { id: true } },
      },
    });

    if (!bankCard) {
      throw new NotFoundException('❌ کارت بانکی مورد نظر یافت نشد');
    }

    // بررسی استفاده در فاکتور یا پرداخت
    if (bankCard.invoices.length > 0 || bankCard.payments.length > 0) {
      throw new BadRequestException('❌ این کارت در فاکتورها یا پرداخت‌ها استفاده شده است. فقط می‌توانید آن را غیرفعال کنید');
    }

    // جلوگیری از حذف تنها کارت فعال
    const activeCards = await this.prisma.bankCard.count({
      where: {
        agencyId: agencyId,
        status: BankCardStatus.ACTIVE,
        id: { not: cardId },
      },
    });

    if (activeCards === 0 && bankCard.status === BankCardStatus.ACTIVE) {
      throw new BadRequestException('❌ نمی‌توانید تنها کارت فعال را حذف کنید');
    }

    await this.prisma.bankCard.delete({ where: { id: cardId } });

    await this.prisma.activityLog.create({
      data: {
        userId: userId,
        agencyId: agencyId,
        action: 'DELETE_BANK_CARD',
        entityType: 'BankCard',
        entityId: cardId,
      },
    });

    return { message: '✅ کارت بانکی با موفقیت حذف شد' };
  }

  // ============ خواندن کارت (مدیر کل و مدیر آژانس) ============

  async findAll(agencyId: string, userId: string, status?: BankCardStatus) {
    await this.validateBankCardReadAccess(agencyId, userId);

    const where: any = { agencyId: agencyId };
    if (status) {
      where.status = status;
    }

    const bankCards = await this.prisma.bankCard.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return bankCards.map(card => ({
      ...card,
      maskedCardNumber: '****-****-****-****',
    }));
  }

  async findOne(agencyId: string, userId: string, cardId: string) {
    await this.validateBankCardReadAccess(agencyId, userId);

    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: cardId,
        agencyId: agencyId,
      },
    });

    if (!bankCard) {
      throw new NotFoundException('❌ کارت بانکی مورد نظر یافت نشد');
    }

    return {
      ...bankCard,
      maskedCardNumber: '****-****-****-****',
    };
  }

  async getDefaultCard(agencyId: string, userId: string) {
    await this.validateBankCardReadAccess(agencyId, userId);

    const defaultCard = await this.prisma.bankCard.findFirst({
      where: {
        agencyId: agencyId,
        isDefault: true,
        status: BankCardStatus.ACTIVE,
      },
    });

    if (!defaultCard) {
      const firstActive = await this.prisma.bankCard.findFirst({
        where: {
          agencyId: agencyId,
          status: BankCardStatus.ACTIVE,
        },
      });
      return firstActive;
    }

    return defaultCard;
  }
}