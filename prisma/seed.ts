// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import 'dotenv/config';           // ← Important
import { PrismaPg } from '@prisma/adapter-pg';   // PostgreSQL adapter
import { Pool } from 'pg';                        // or use connection string directly
import * as bcrypt from 'bcrypt'

const connectionString = process.env.DATABASE_URL!;

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });
async function main() {
  console.log('🌱 Starting database seeding...')
  console.log('📡 DATABASE_URL from env:', process.env.DATABASE_URL)

  // Test connection
  await prisma.$connect()
  console.log('✅ Database connected successfully')

  // ============ 1. Create Plans ============
  console.log('📋 Creating plans...')
  
  const plans = await prisma.plan.createMany({
    data: [
      {
        name: "Basic",
        priceMonthly: 99,
        priceYearly: 990,
        maxNormalUsers: 5,
        maxAgencyManagers: 2,
        maxTicketsPerMonth: 100,
        maxInvoicesPerMonth: 50,
        isActive: true,
      },
      {
        name: "Pro",
        priceMonthly: 199,
        priceYearly: 1990,
        maxNormalUsers: 20,
        maxAgencyManagers: 5,
        maxTicketsPerMonth: 500,
        maxInvoicesPerMonth: 200,
        isActive: true,
      },
      {
        name: "Enterprise",
        priceMonthly: 499,
        priceYearly: 4990,
        maxNormalUsers: 100,
        maxAgencyManagers: 20,
        maxTicketsPerMonth: null,
        maxInvoicesPerMonth: null,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  })
  console.log(`✅ Created ${plans.count} plans`)

  // ============ 2. Create Agencies ============
  console.log('🏢 Creating agencies...')
  
  const agency1 = await prisma.agency.upsert({
    where: { email: 'travelplus@example.com' },
    update: {},
    create: {
      name: 'Travel Plus Agency',
      registrationNumber: 'REG123456',
      phone: '+1234567890',
      email: 'travelplus@example.com',
      address: '123 Business Ave, Suite 100',
      status: 'ACTIVE',
      trialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const agency2 = await prisma.agency.upsert({
    where: { email: 'worldtravel@example.com' },
    update: {},
    create: {
      name: 'World Travel Agency',
      registrationNumber: 'REG789012',
      phone: '+9876543210',
      email: 'worldtravel@example.com',
      address: '456 Global Street',
      status: 'TRIAL',
      trialExpiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
  })
  
  console.log(`✅ Created agencies: ${agency1.name}, ${agency2.name}`)

  // ============ 3. Create Users ============
  console.log('👤 Creating users...')
  
  const hashedPassword = await bcrypt.hash('Password123!', 10)
  
  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: {},
    create: {
      email: 'admin@system.com',
      passwordHash: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1111111111',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    },
  })
  
  // General Manager for Agency 1
  const generalManager = await prisma.user.upsert({
    where: { email: 'manager@travelplus.com' },
    update: {},
    create: {
      email: 'manager@travelplus.com',
      passwordHash: hashedPassword,
      firstName: 'John',
      lastName: 'Smith',
      phone: '+1234567891',
      role: 'GENERAL_MANAGER',
      status: 'ACTIVE',
      agencyId: agency1.id,
    },
  })
  
  // Agency Manager for Agency 1
  const agencyManager = await prisma.user.upsert({
    where: { email: 'agent@travelplus.com' },
    update: {},
    create: {
      email: 'agent@travelplus.com',
      passwordHash: hashedPassword,
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '+1234567892',
      role: 'AGENCY_MANAGER',
      status: 'ACTIVE',
      agencyId: agency1.id,
    },
  })
  
  // Normal User for Agency 1
  const normalUser = await prisma.user.upsert({
    where: { email: 'user@travelplus.com' },
    update: {},
    create: {
      email: 'user@travelplus.com',
      passwordHash: hashedPassword,
      firstName: 'Mike',
      lastName: 'Brown',
      phone: '+1234567893',
      role: 'NORMAL_USER',
      status: 'ACTIVE',
      agencyId: agency1.id,
    },
  })
  
  console.log(`✅ Created users: ${superAdmin.email}, ${generalManager.email}, ${agencyManager.email}, ${normalUser.email}`)

  // ============ 4. Create Bank Cards ============
  console.log('💳 Creating bank cards...')
  
  const bankCard1 = await prisma.bankCard.create({
    data: {
      agencyId: agency1.id,
      cardNumber: 'tok_visa_4242',
      bankName: 'National Bank',
      accountHolder: 'Travel Plus Agency',
      sheba: 'IR01234567890123456789',
      isDefault: true,
      status: 'ACTIVE',
    },
  })
  
  const bankCard2 = await prisma.bankCard.create({
    data: {
      agencyId: agency1.id,
      cardNumber: 'tok_mastercard_5555',
      bankName: 'City Bank',
      accountHolder: 'Travel Plus Agency',
      sheba: 'IR98765432109876543210',
      isDefault: false,
      status: 'ACTIVE',
    },
  })
  
  console.log(`✅ Created bank cards for ${agency1.name}`)

  // ============ 5. Create Tickets ============
  console.log('🎫 Creating tickets...')
  
  const ticket1 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TK001',
      referenceNumber: 'REF001',
      agencyId: agency1.id,
      userId: normalUser.id,
      passengerName: 'John Doe',
      passengerPhone: '+1234567890',
      flightNumber: 'FL123',
      origin: 'New York (JFK)',
      destination: 'London (LHR)',
      flightDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      seatClass: 'Economy',
      price: 850.00,
      status: 'COMPLETED',
    },
  })
  
  const ticket2 = await prisma.ticket.create({
    data: {
      ticketNumber: 'TK002',
      referenceNumber: 'REF002',
      agencyId: agency1.id,
      userId: normalUser.id,
      passengerName: 'Jane Smith',
      passengerPhone: '+1234567891',
      flightNumber: 'FL456',
      origin: 'London (LHR)',
      destination: 'Paris (CDG)',
      flightDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      seatClass: 'Business',
      price: 450.00,
      status: 'DRAFT',
    },
  })
  
  console.log(`✅ Created tickets: ${ticket1.ticketNumber}, ${ticket2.ticketNumber}`)

  // ============ 6. Create Invoice ============
  console.log('📄 Creating invoice...')
  
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-2024-0001',
      agencyId: agency1.id,
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      bankCardId: bankCard1.id,
      templateStyle: 1,
      subtotal: 850.00,
      total: 850.00,
      status: 'UNPAID',
      tickets: {
        connect: [{ id: ticket1.id }],
      },
    },
  })
  
  console.log(`✅ Created invoice: ${invoice.invoiceNumber}`)

  // ============ 7. Create Support Ticket ============
  console.log('🎫 Creating support ticket...')
  
  const supportTicket = await prisma.supportTicket.create({
    data: {
      ticketNumber: 'SUP-001',
      title: 'Login Issue',
      description: 'Unable to login to the dashboard',
      senderType: 'AGENCY',
      agencyId: agency1.id,
      userId: generalManager.id,
      priority: 'HIGH',
      status: 'OPEN',
    },
  })
  
  await prisma.supportTicketReply.create({
    data: {
      ticketId: supportTicket.id,
      userId: superAdmin.id,
      message: 'We are looking into this issue. Please clear your browser cache and try again.',
      isInternal: false,
    },
  })
  
  console.log(`✅ Created support ticket with reply`)

  // ============ 8. Create Organization ============
  console.log('🏛️ Creating organization...')
  
  const organization = await prisma.organization.upsert({
    where: { email: 'corp@bigcompany.com' },
    update: {},
    create: {
      name: 'Big Corporation Ltd',
      nationalId: '1234567890',
      phone: '+1122334455',
      email: 'corp@bigcompany.com',
      address: 'Corporate Tower, Floor 10',
      hasPanel: true,
      panelCreatedAt: new Date(),
    },
  })
  
  await prisma.user.upsert({
    where: { email: 'admin@bigcompany.com' },
    update: {},
    create: {
      email: 'admin@bigcompany.com',
      passwordHash: hashedPassword,
      firstName: 'Corporate',
      lastName: 'Admin',
      phone: '+1122334456',
      role: 'ORGANIZATION_ADMIN',
      status: 'ACTIVE',
      organizationId: organization.id,
    },
  })
  
  console.log(`✅ Created organization: ${organization.name}`)

  // ============ 9. Create Activity Log ============
  console.log('📝 Creating activity logs...')
  
  await prisma.activityLog.createMany({
    data: [
      {
        userId: normalUser.id,
        agencyId: agency1.id,
        action: 'CREATE_TICKET',
        entityType: 'Ticket',
        entityId: ticket1.id,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
      {
        userId: generalManager.id,
        agencyId: agency1.id,
        action: 'APPROVE_INVOICE',
        entityType: 'Invoice',
        entityId: invoice.id,
        ipAddress: '192.168.1.2',
        userAgent: 'Mozilla/5.0',
      },
    ],
  })
  
  console.log(`✅ Created activity logs`)

  // ============ 10. Create Registration Request ============
  console.log('📝 Creating registration request...')
  
  await prisma.registrationRequest.create({
    data: {
      agencyName: 'New Travel Agency',
      registrationNumber: 'REG999999',
      contactName: 'New Contact Person',
      contactPhone: '+9999999999',
      contactEmail: 'new@travelagency.com',
      message: 'We want to join the platform',
      status: 'PENDING',
    },
  })
  
  console.log('✅ Created registration request')

  console.log('🎉 Database seeding completed successfully!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })