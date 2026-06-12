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
    // در محیط واقعی: call PSP tokenization API
    // اینجا فقط برای نمونه از SHA256 استفاده می‌شود
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
      throw new ForbiddenException('Only General Manager can manage bank cards');
    }

    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });

    if (!agency || (agency.status !== AgencyStatus.ACTIVE && agency.status !== AgencyStatus.TRIAL)) {
      throw new ForbiddenException('Agency is not active');
    }

    return user;
  }

  // ============ CRUD Operations ============

  async create(agencyId: string, userId: string, dto: CreateBankCardDto) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    // Check if card number already exists for this agency
    const tokenizedCard = this.tokenizeCardNumber(dto.cardNumber);
    
    const existingCard = await this.prisma.bankCard.findFirst({
      where: {
        agencyId: agencyId,
        cardNumber: tokenizedCard,
      },
    });

    if (existingCard) {
      throw new ConflictException('This card number has already been added to this agency');
    }

    // If this card is set as default, remove default from other cards
    if (dto.isDefault) {
      await this.prisma.bankCard.updateMany({
        where: { agencyId: agencyId },
        data: { isDefault: false },
      });
    } else {
      // If this is the first card, make it default automatically
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

    // Log activity
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

    // Return masked card number
    return {
      ...bankCard,
      maskedCardNumber: this.maskCardNumber(dto.cardNumber),
      cardNumber: undefined,
    };
  }

  async findAll(agencyId: string, userId: string, status?: BankCardStatus) {
    await this.validateGeneralManagerAccess(agencyId, userId);

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

    // Return cards with masked numbers (but we don't have original numbers)
    // In real scenario, tokenized numbers are stored, so we show masked version
    return bankCards.map(card => ({
      ...card,
      maskedCardNumber: '****-****-****-****', // در واقعیت از PSP می‌گیریم
    }));
  }

  async findOne(agencyId: string, userId: string, cardId: string) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    const bankCard = await this.prisma.bankCard.findFirst({
      where: {
        id: cardId,
        agencyId: agencyId,
      },
    });

    if (!bankCard) {
      throw new NotFoundException('Bank card not found');
    }

    return {
      ...bankCard,
      maskedCardNumber: '****-****-****-****',
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
      throw new NotFoundException('Bank card not found');
    }

    // If changing default status
    if (dto.isDefault === true) {
      await this.prisma.bankCard.updateMany({
        where: { agencyId: agencyId },
        data: { isDefault: false },
      });
    }

    // If card number is being updated, tokenize new number
    let updateData: any = {
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

    // Log activity
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
      throw new NotFoundException('Bank card not found');
    }

    // Prevent deactivating the only active card
    if (status === BankCardStatus.INACTIVE) {
      const activeCards = await this.prisma.bankCard.count({
        where: {
          agencyId: agencyId,
          status: BankCardStatus.ACTIVE,
          id: { not: cardId },
        },
      });

      if (activeCards === 0) {
        throw new BadRequestException('Cannot deactivate the only active bank card');
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
      throw new NotFoundException('Bank card not found');
    }

    if (bankCard.status !== BankCardStatus.ACTIVE) {
      throw new BadRequestException('Cannot set inactive card as default');
    }

    // Remove default from all cards
    await this.prisma.bankCard.updateMany({
      where: { agencyId: agencyId },
      data: { isDefault: false },
    });

    // Set this card as default
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
        invoices: {
          take: 1,
          select: { id: true },
        },
        payments: {
          take: 1,
          select: { id: true },
        },
      },
    });

    if (!bankCard) {
      throw new NotFoundException('Bank card not found');
    }

    // Check if card is used in any invoice or payment
    if (bankCard.invoices.length > 0 || bankCard.payments.length > 0) {
      throw new BadRequestException('Cannot delete card that has been used in invoices or payments. Deactivate instead.');
    }

    // Prevent deleting the only active card
    const activeCards = await this.prisma.bankCard.count({
      where: {
        agencyId: agencyId,
        status: BankCardStatus.ACTIVE,
        id: { not: cardId },
      },
    });

    if (activeCards === 0 && bankCard.status === BankCardStatus.ACTIVE) {
      throw new BadRequestException('Cannot delete the only active bank card');
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

    return { message: 'Bank card deleted successfully' };
  }

  async getDefaultCard(agencyId: string, userId: string) {
    await this.validateGeneralManagerAccess(agencyId, userId);

    const defaultCard = await this.prisma.bankCard.findFirst({
      where: {
        agencyId: agencyId,
        isDefault: true,
        status: BankCardStatus.ACTIVE,
      },
    });

    if (!defaultCard) {
      // If no default card, get the first active card
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