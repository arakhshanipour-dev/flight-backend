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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 100,
        },
      ],
    }),
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // JWT guard global
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // Roles guard global
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Rate limiting global
    },
  ],
})
export class AppModule {}