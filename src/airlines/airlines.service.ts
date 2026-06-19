import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAirlineDto, UpdateAirlineDto } from './dto';
import { UserRole } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { AIRLINE_CACHE_KEYS } from './airlines.constants';

export interface FindAllAirlinesOptions {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class AirlinesService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private sanitizeString(input: string): string {
    if (!input) return input;
    return input.trim().replace(/[<>]/g, '');
  }

  private async validateSuperAdminAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, role: UserRole.SUPER_ADMIN },
    });
    if (!user) {
      throw new ForbiddenException('Only Super Admin can perform this action');
    }
    return user;
  }

  private async invalidateCache(): Promise<void> {
    await Promise.all([
      this.cacheManager.del(AIRLINE_CACHE_KEYS.ALL),
      this.cacheManager.del(AIRLINE_CACHE_KEYS.POPULAR),
    ]);
  }

  // ============ Admin Methods ============

  async create(adminId: string, dto: CreateAirlineDto) {
    await this.validateSuperAdminAccess(adminId);

    // Check for duplicate IATA
    const existingIata = await this.prisma.airline.findUnique({
      where: { iataCode: dto.iataCode.toUpperCase() },
    });
    if (existingIata) {
      throw new ConflictException(`Airline with IATA code ${dto.iataCode} already exists`);
    }

    // Check for duplicate ICAO if provided
    if (dto.icaoCode) {
      const existingIcao = await this.prisma.airline.findUnique({
        where: { icaoCode: dto.icaoCode.toUpperCase() },
      });
      if (existingIcao) {
        throw new ConflictException(`Airline with ICAO code ${dto.icaoCode} already exists`);
      }
    }

    const airline = await this.prisma.airline.create({
      data: {
        iataCode: dto.iataCode.toUpperCase(),
        icaoCode: dto.icaoCode?.toUpperCase(),
        name: this.sanitizeString(dto.name),
        country: dto.country ? this.sanitizeString(dto.country) : 'IRAN',
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    // ===== ACTIVITY LOG (COMMENTED) =====
    // TODO: Uncomment when ActivityLog module is ready
    // await this.prisma.activityLog.create({
    //   data: {
    //     userId: adminId,
    //     action: 'CREATE_AIRLINE',
    //     entityType: 'Airline',
    //     entityId: airline.id,
    //     newData: { iataCode: dto.iataCode, name: dto.name },
    //   },
    // });

    await this.invalidateCache();

    return airline;
  }

  async update(adminId: string, id: string, dto: UpdateAirlineDto) {
    await this.validateSuperAdminAccess(adminId);

    const airline = await this.prisma.airline.findUnique({ where: { id } });
    if (!airline) {
      throw new NotFoundException(`Airline with ID ${id} not found`);
    }

    // Check for duplicate IATA if changed
    if (dto.iataCode && dto.iataCode.toUpperCase() !== airline.iataCode) {
      const existingIata = await this.prisma.airline.findUnique({
        where: { iataCode: dto.iataCode.toUpperCase() },
      });
      if (existingIata) {
        throw new ConflictException(`Airline with IATA code ${dto.iataCode} already exists`);
      }
    }

    // Check for duplicate ICAO if changed
    if (dto.icaoCode && dto.icaoCode.toUpperCase() !== airline.icaoCode) {
      const existingIcao = await this.prisma.airline.findUnique({
        where: { icaoCode: dto.icaoCode.toUpperCase() },
      });
      if (existingIcao) {
        throw new ConflictException(`Airline with ICAO code ${dto.icaoCode} already exists`);
      }
    }

    const updated = await this.prisma.airline.update({
      where: { id },
      data: {
        iataCode: dto.iataCode?.toUpperCase(),
        icaoCode: dto.icaoCode?.toUpperCase(),
        name: dto.name ? this.sanitizeString(dto.name) : undefined,
        country: dto.country ? this.sanitizeString(dto.country) : undefined,
        isActive: dto.isActive,
      },
    });

    // ===== ACTIVITY LOG (COMMENTED) =====
    // TODO: Uncomment when ActivityLog module is ready
    // await this.prisma.activityLog.create({
    //   data: {
    //     userId: adminId,
    //     action: 'UPDATE_AIRLINE',
    //     entityType: 'Airline',
    //     entityId: id,
    //     newData: { updatedFields: Object.keys(dto) },
    //   },
    // });

    await this.invalidateCache();

    return updated;
  }

  async delete(adminId: string, id: string) {
    await this.validateSuperAdminAccess(adminId);

    const airline = await this.prisma.airline.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!airline) {
      throw new NotFoundException(`Airline with ID ${id} not found`);
    }

    if (airline._count.tickets > 0) {
      throw new BadRequestException(
        `Cannot delete airline with ${airline._count.tickets} associated tickets. Deactivate it instead.`,
      );
    }

    await this.prisma.airline.delete({ where: { id } });

    // ===== ACTIVITY LOG (COMMENTED) =====
    // TODO: Uncomment when ActivityLog module is ready
    // await this.prisma.activityLog.create({
    //   data: {
    //     userId: adminId,
    //     action: 'DELETE_AIRLINE',
    //     entityType: 'Airline',
    //     entityId: id,
    //   },
    // });

    await this.invalidateCache();

    return { message: 'Airline deleted successfully' };
  }

  // ============ Public Methods ============

  async findAll(options: FindAllAirlinesOptions) {
    const { page = 1, limit = 20, search, isActive } = options;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      const sanitized = this.sanitizeString(search);
      where.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { iataCode: { contains: sanitized, mode: 'insensitive' } },
        { icaoCode: { contains: sanitized, mode: 'insensitive' } },
        { country: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.airline.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' },
        ],
      }),
      this.prisma.airline.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit: Math.min(limit, 100),
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const airline = await this.prisma.airline.findUnique({
      where: { id },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!airline) {
      throw new NotFoundException(`Airline with ID ${id} not found`);
    }

    return airline;
  }

  async findByIata(iataCode: string) {
    const airline = await this.prisma.airline.findUnique({
      where: { iataCode: iataCode.toUpperCase() },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!airline) {
      throw new NotFoundException(`Airline with IATA code ${iataCode} not found`);
    }

    return airline;
  }

  async findByIcao(icaoCode: string) {
    const airline = await this.prisma.airline.findUnique({
      where: { icaoCode: icaoCode.toUpperCase() },
      include: {
        _count: {
          select: { tickets: true },
        },
      },
    });

    if (!airline) {
      throw new NotFoundException(`Airline with ICAO code ${icaoCode} not found`);
    }

    return airline;
  }

  async search(query: string, limit: number = 10) {
    const sanitized = this.sanitizeString(query);
    
    return this.prisma.airline.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: sanitized, mode: 'insensitive' } },
          { iataCode: { contains: sanitized.toUpperCase(), mode: 'insensitive' } },
          { icaoCode: { contains: sanitized.toUpperCase(), mode: 'insensitive' } },
          { country: { contains: sanitized, mode: 'insensitive' } },
        ],
      },
      take: Math.min(limit, 20),
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async getPopularAirlines(limit: number = 10) {
    const cacheKey = AIRLINE_CACHE_KEYS.POPULAR;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const airlines = await this.prisma.$queryRaw<any[]>`
      SELECT 
        a.id as "airlineId",
        a.name as "airlineName",
        a.iata_code as "iataCode",
        COUNT(t.id) as count
      FROM "Airline" a
      LEFT JOIN "Ticket" t ON t.airline_id = a.id
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.iata_code
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    await this.cacheManager.set(cacheKey, airlines, 3600);

    return airlines;
  }
}