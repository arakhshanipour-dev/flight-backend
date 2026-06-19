import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAirportDto, UpdateAirportDto } from './dto';
import { AirportType, UserRole } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';  // ✅ استفاده از import type
import { AIRPORT_CACHE_KEYS } from './airports.constants';

export interface FindAllAirportsOptions {
  page?: number;
  limit?: number;
  type?: AirportType;
  province?: string;
  city?: string;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class AirportsService {
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
      this.cacheManager.del(AIRPORT_CACHE_KEYS.ALL),
      this.cacheManager.del(AIRPORT_CACHE_KEYS.POPULAR),
    ]);
    // Wildcard pattern - we'll handle this by invalidating specific keys
  }

  // ============ Admin Methods ============

  async create(adminId: string, dto: CreateAirportDto) {
    await this.validateSuperAdminAccess(adminId);

    // Check for duplicate IATA
    const existingIata = await this.prisma.airport.findUnique({
      where: { iataCode: dto.iataCode.toUpperCase() },
    });
    if (existingIata) {
      throw new ConflictException(`Airport with IATA code ${dto.iataCode} already exists`);
    }

    // Check for duplicate ICAO if provided
    if (dto.icaoCode) {
      const existingIcao = await this.prisma.airport.findUnique({
        where: { icaoCode: dto.icaoCode.toUpperCase() },
      });
      if (existingIcao) {
        throw new ConflictException(`Airport with ICAO code ${dto.icaoCode} already exists`);
      }
    }

    const airport = await this.prisma.airport.create({
      data: {
        iataCode: dto.iataCode.toUpperCase(),
        icaoCode: dto.icaoCode?.toUpperCase(),
        name: this.sanitizeString(dto.name),
        city: this.sanitizeString(dto.city),
        province: this.sanitizeString(dto.province),
        country: dto.country ? this.sanitizeString(dto.country) : 'IRAN',
        timezone: dto.timezone || 'Asia/Tehran',
        type: dto.type || AirportType.DOMESTIC,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    // Log activity
    // await this.prisma.activityLog.create({
    //   data: {
    //     userId: adminId,
    //     action: 'CREATE_AIRPORT',
    //     entityType: 'Airport',
    //     entityId: airport.id,
    //     newData: { iataCode: dto.iataCode, name: dto.name },
    //   },
    // });

    await this.invalidateCache();

    return airport;
  }

  async update(adminId: string, id: string, dto: UpdateAirportDto) {
    await this.validateSuperAdminAccess(adminId);

    const airport = await this.prisma.airport.findUnique({ where: { id } });
    if (!airport) {
      throw new NotFoundException(`Airport with ID ${id} not found`);
    }

    // Check for duplicate IATA if changed
    if (dto.iataCode && dto.iataCode.toUpperCase() !== airport.iataCode) {
      const existingIata = await this.prisma.airport.findUnique({
        where: { iataCode: dto.iataCode.toUpperCase() },
      });
      if (existingIata) {
        throw new ConflictException(`Airport with IATA code ${dto.iataCode} already exists`);
      }
    }

    // Check for duplicate ICAO if changed
    if (dto.icaoCode && dto.icaoCode.toUpperCase() !== airport.icaoCode) {
      const existingIcao = await this.prisma.airport.findUnique({
        where: { icaoCode: dto.icaoCode.toUpperCase() },
      });
      if (existingIcao) {
        throw new ConflictException(`Airport with ICAO code ${dto.icaoCode} already exists`);
      }
    }

    const updated = await this.prisma.airport.update({
      where: { id },
      data: {
        iataCode: dto.iataCode?.toUpperCase(),
        icaoCode: dto.icaoCode?.toUpperCase(),
        name: dto.name ? this.sanitizeString(dto.name) : undefined,
        city: dto.city ? this.sanitizeString(dto.city) : undefined,
        province: dto.province ? this.sanitizeString(dto.province) : undefined,
        country: dto.country ? this.sanitizeString(dto.country) : undefined,
        timezone: dto.timezone,
        type: dto.type,
        isActive: dto.isActive,
      },
    });

    // await this.prisma.activityLog.create({
    //   data: {
    //     userId: adminId,
    //     action: 'UPDATE_AIRPORT',
    //     entityType: 'Airport',
    //     entityId: id,
    //     newData: { updatedFields: Object.keys(dto) },
    //   },
    // });

    await this.invalidateCache();

    return updated;
  }

  async delete(adminId: string, id: string) {
    await this.validateSuperAdminAccess(adminId);

    const airport = await this.prisma.airport.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            originTickets: true,
            destinationTickets: true,
          },
        },
      },
    });

    if (!airport) {
      throw new NotFoundException(`Airport with ID ${id} not found`);
    }

    const totalTickets = airport._count.originTickets + airport._count.destinationTickets;
    if (totalTickets > 0) {
      throw new BadRequestException(
        `Cannot delete airport with ${totalTickets} associated tickets. Deactivate it instead.`,
      );
    }

    await this.prisma.airport.delete({ where: { id } });

    // await this.prisma.activityLog.create({
    //   data: {
    //     userId: adminId,
    //     action: 'DELETE_AIRPORT',
    //     entityType: 'Airport',
    //     entityId: id,
    //   },
    // });

    await this.invalidateCache();

    return { message: 'Airport deleted successfully' };
  }

  // ============ Public Methods ============

  async findAll(options: FindAllAirportsOptions) {
    const { page = 1, limit = 20, type, province, city, search, isActive } = options;

    const skip = (page - 1) * limit;
    const where: any = {};

    if (type) where.type = type;
    if (province) where.province = { contains: province, mode: 'insensitive' };
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (isActive !== undefined) where.isActive = isActive;

    if (search) {
      const sanitized = this.sanitizeString(search);
      where.OR = [
        { name: { contains: sanitized, mode: 'insensitive' } },
        { city: { contains: sanitized, mode: 'insensitive' } },
        { province: { contains: sanitized, mode: 'insensitive' } },
        { iataCode: { contains: sanitized, mode: 'insensitive' } },
        { icaoCode: { contains: sanitized, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.airport.findMany({
        where,
        skip,
        take: Math.min(limit, 100),
        orderBy: [
          { isActive: 'desc' },
          { name: 'asc' },
        ],
      }),
      this.prisma.airport.count({ where }),
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
    const airport = await this.prisma.airport.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            originTickets: true,
            destinationTickets: true,
          },
        },
      },
    });

    if (!airport) {
      throw new NotFoundException(`Airport with ID ${id} not found`);
    }

    return airport;
  }

  async findByIata(iataCode: string) {
    const airport = await this.prisma.airport.findUnique({
      where: { iataCode: iataCode.toUpperCase() },
      include: {
        _count: {
          select: {
            originTickets: true,
            destinationTickets: true,
          },
        },
      },
    });

    if (!airport) {
      throw new NotFoundException(`Airport with IATA code ${iataCode} not found`);
    }

    return airport;
  }

  async findByProvince(province: string) {
    return this.prisma.airport.findMany({
      where: {
        province: { contains: province, mode: 'insensitive' },
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findByCity(city: string) {
    return this.prisma.airport.findMany({
      where: {
        city: { contains: city, mode: 'insensitive' },
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async search(query: string, limit: number = 10) {
    const sanitized = this.sanitizeString(query);
    
    return this.prisma.airport.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: sanitized, mode: 'insensitive' } },
          { city: { contains: sanitized, mode: 'insensitive' } },
          { province: { contains: sanitized, mode: 'insensitive' } },
          { iataCode: { contains: sanitized.toUpperCase(), mode: 'insensitive' } },
          { icaoCode: { contains: sanitized.toUpperCase(), mode: 'insensitive' } },
        ],
      },
      take: Math.min(limit, 20),
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  async getPopularAirports(limit: number = 10) {
    // Use cached data if available
    const cacheKey = AIRPORT_CACHE_KEYS.POPULAR;
    const cached = await this.cacheManager.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const airports = await this.prisma.$queryRaw<any[]>`
      SELECT 
        a.id as "airportId",
        a.name as "airportName",
        a.iata_code as "iataCode",
        a.city,
        a.province,
        COUNT(t.id) as count
      FROM "Airport" a
      LEFT JOIN "Ticket" t ON t.origin_airport_id = a.id OR t.destination_airport_id = a.id
      WHERE a.is_active = true
      GROUP BY a.id, a.name, a.iata_code, a.city, a.province
      ORDER BY count DESC
      LIMIT ${limit}
    `;

    // Cache for 1 hour
    await this.cacheManager.set(cacheKey, airports, 3600);

    return airports;
  }

  async getProvinces() {
    const provinces = await this.prisma.airport.groupBy({
      by: ['province'],
      _count: {
        province: true,
      },
      where: {
        isActive: true,
      },
      orderBy: {
        province: 'asc',
      },
    });

    return provinces.map(p => ({
      province: p.province,
      count: p._count.province,
    }));
  }
}