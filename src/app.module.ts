import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AgenciesModule } from './agencies/agencies.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RegistrationRequestsModule } from './registration-requests/registration-requests.module';
import { AgencyUsersModule } from './agency-users/agency-users.module';
import { TicketsModule } from './tickets/tickets.module';
import { BankCardsModule } from './bank-cards/bank-cards.module';
import { InvoicesModule } from './invoices/invoices.module';
import { PaymentsModule } from './payments/payments.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { SupportTicketsModule } from './support-tickets/support-tickets.module';
import { AccountingModule } from './accounting/accounting.module';
import { PlansModule } from './plans/plans.module';
import { AirportsModule } from './airports/airports.module';
import { AirlinesModule } from './airlines/airlines.module';
import { CacheModule } from '@nestjs/cache-manager';
import { ActivityLogsModule } from './activity-logs/activity-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    CacheModule.register({
      ttl: 3600, // 1 hour default TTL
      max: 100, // maximum number of items in cache
      isGlobal: true, // باعث می‌شود در سراسر برنامه در دسترس باشد
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 10,
      },
      {
        name: 'sensitive',
        ttl: 60000,
        limit: 20,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    AgenciesModule,
    RegistrationRequestsModule,
    AgencyUsersModule,
    TicketsModule,
    BankCardsModule,
    InvoicesModule,
    PaymentsModule,
    OrganizationsModule,
    SupportTicketsModule,
    AccountingModule,
    PlansModule,
    AirportsModule,
    AirlinesModule,
    ActivityLogsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}