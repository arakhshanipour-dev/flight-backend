// prisma/seed.ts
import { PrismaClient, TicketStatus } from '@prisma/client'
import 'dotenv/config';
import * as bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  console.log('🌱 شروع عملیات Seed دیتابیس...')

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('❌ DATABASE_URL در فایل .env تعریف نشده است');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  console.log('✅ اتصال به دیتابیس برقرار شد');

  try {
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // ============ 1. پاکسازی داده‌های قبلی ============
    console.log('🗑️ پاکسازی داده‌های قبلی...');
    
    await prisma.payment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.penalty.deleteMany();
    await prisma.activityLog.deleteMany();
    await prisma.supportTicketReply.deleteMany();
    await prisma.supportTicket.deleteMany();
    await prisma.bankCard.deleteMany();
    await prisma.agencyPlan.deleteMany();
    await prisma.user.deleteMany();
    await prisma.agency.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.registrationRequest.deleteMany();
    await prisma.plan.deleteMany();

    // ============ 2. ایجاد پلن‌ها ============
    console.log('📋 ایجاد پلن‌های اشتراک...');
    
    await prisma.plan.createMany({
      data: [
        { 
          name: "Basic", 
          description: "پلن پایه مناسب آژانس‌های کوچک",
          priceMonthly: 990000, 
          priceYearly: 9900000, 
          maxNormalUsers: 5, 
          maxAgencyManagers: 2, 
          maxTicketsPerMonth: 100, 
          maxInvoicesPerMonth: 50, 
          isActive: true 
        },
        { 
          name: "Pro", 
          description: "پلن حرفه‌ای برای آژانس‌های رو به رشد",
          priceMonthly: 1990000, 
          priceYearly: 19900000, 
          maxNormalUsers: 20, 
          maxAgencyManagers: 5, 
          maxTicketsPerMonth: 500, 
          maxInvoicesPerMonth: 200, 
          isActive: true 
        },
        { 
          name: "Enterprise", 
          description: "پلن نامحدود سازمانی و بزرگ",
          priceMonthly: 4990000, 
          priceYearly: 49900000, 
          maxNormalUsers: 100, 
          maxAgencyManagers: 20, 
          maxTicketsPerMonth: null, 
          maxInvoicesPerMonth: null, 
          isActive: true 
        },
      ],
    });

    const basicPlan = await prisma.plan.findUnique({ where: { name: 'Basic' } });
    const proPlan = await prisma.plan.findUnique({ where: { name: 'Pro' } });
    const enterprisePlan = await prisma.plan.findUnique({ where: { name: 'Enterprise' } });

    // ============ 3. ایجاد آژانس‌ها ============
    console.log('🏢 ایجاد آژانس‌ها...');

    const agency1 = await prisma.agency.create({ data: { 
      name: 'آژانس سفر پلاس', registrationNumber: 'REG-14031234', phone: '021-88551234', 
      email: 'info@travelplus.ir', address: 'تهران، خیابان ولیعصر، پلاک ۱۲۳۴', status: 'ACTIVE' 
    }});

    const agency2 = await prisma.agency.create({ data: { 
      name: 'آژانس جهانگردی پارسی', registrationNumber: 'REG-14035678', phone: '021-77654321', 
      email: 'info@parsiworld.ir', address: 'مشهد، خیابان احمدآباد، پلاک ۵۶۷', status: 'ACTIVE' 
    }});

    const agency3 = await prisma.agency.create({ data: { 
      name: 'آژانس پرواز طلایی', registrationNumber: 'REG-14039876', phone: '031-31345678', 
      email: 'goldfly@agency.ir', address: 'اصفهان، خیابان امام، مجتمع تجاری ۹۸', status: 'TRIAL' 
    }});

    const agency4 = await prisma.agency.create({ data: { 
      name: 'آژانس آسمان آبی', registrationNumber: 'REG-14036543', phone: '051-38456789', 
      email: 'blue@skyagency.ir', address: 'شیراز، بلوار چمران، پلاک ۷۸۹', status: 'ACTIVE' 
    }});

    const agency5 = await prisma.agency.create({ data: { 
      name: 'آژانس پرواز ققنوس', registrationNumber: 'REG-14037890', phone: '021-22987654', 
      email: 'phoenix@travel.ir', address: 'تهران، فرمانیه، خیابان دیداری', status: 'ACTIVE' 
    }});

    // Assign Plans
    await prisma.agencyPlan.createMany({
      data: [
        { agencyId: agency1.id, planId: proPlan!.id, startDate: new Date(), endDate: new Date(Date.now() + 365*24*60*60*1000), isActive: true },
        { agencyId: agency2.id, planId: basicPlan!.id, startDate: new Date(), endDate: new Date(Date.now() + 365*24*60*60*1000), isActive: true },
        { agencyId: agency3.id, planId: basicPlan!.id, startDate: new Date(), endDate: null, isActive: true },
        { agencyId: agency4.id, planId: enterprisePlan!.id, startDate: new Date(), endDate: new Date(Date.now() + 730*24*60*60*1000), isActive: true },
        { agencyId: agency5.id, planId: proPlan!.id, startDate: new Date(), endDate: new Date(Date.now() + 180*24*60*60*1000), isActive: true },
      ]
    });

    // ============ 4. ایجاد کاربران ============
    console.log('👤 ایجاد کاربران...');

    const users = [
      { email: 'admin@system.ir', firstName: 'مدیر', lastName: 'سیستم', role: 'SUPER_ADMIN' as const },
      { email: 'gm@travelplus.ir', firstName: 'علی', lastName: 'رضایی', role: 'GENERAL_MANAGER' as const, agencyId: agency1.id },
      { email: 'manager1@travelplus.ir', firstName: 'فاطمه', lastName: 'احمدی', role: 'AGENCY_MANAGER' as const, agencyId: agency1.id },
      { email: 'user1@travelplus.ir', firstName: 'محمد', lastName: 'کریمی', role: 'NORMAL_USER' as const, agencyId: agency1.id },
      { email: 'user2@travelplus.ir', firstName: 'زهرا', lastName: 'محمدی', role: 'NORMAL_USER' as const, agencyId: agency1.id },
      { email: 'user3@travelplus.ir', firstName: 'امیر', lastName: 'بهرامی', role: 'NORMAL_USER' as const, agencyId: agency1.id },
      { email: 'gm@parsiworld.ir', firstName: 'حسین', lastName: 'رضوانی', role: 'GENERAL_MANAGER' as const, agencyId: agency2.id },
      { email: 'manager@parsiworld.ir', firstName: 'مریم', lastName: 'صادقی', role: 'AGENCY_MANAGER' as const, agencyId: agency2.id },
      { email: 'user1@parsiworld.ir', firstName: 'رضا', lastName: 'نوری', role: 'NORMAL_USER' as const, agencyId: agency2.id },
      { email: 'user2@parsiworld.ir', firstName: 'مینا', lastName: 'قاسمی', role: 'NORMAL_USER' as const, agencyId: agency2.id },
    ];

    const createdUsers = await Promise.all(
      users.map(user => prisma.user.create({
        data: {
          ...user,
          passwordHash: hashedPassword,
          phone: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
          status: 'ACTIVE' as const,
        }
      }))
    );

    const superAdmin = createdUsers[0];
    const normalUsers = createdUsers.filter(u => u.role === 'NORMAL_USER');

    // ============ 5. کارت‌های بانکی ============
    console.log('💳 ایجاد کارت‌های بانکی...');

    await prisma.bankCard.createMany({
      data: [
        { agencyId: agency1.id, cardNumber: 'tok_visa_4242', bankName: 'بانک ملی', accountHolder: 'آژانس سفر پلاس', sheba: 'IR01234567890123456789', isDefault: true, status: 'ACTIVE' },
        { agencyId: agency1.id, cardNumber: 'tok_mellat_1234', bankName: 'بانک ملت', accountHolder: 'آژانس سفر پلاس', sheba: 'IR98765432109876543210', isDefault: false, status: 'ACTIVE' },
        { agencyId: agency2.id, cardNumber: 'tok_saderat_5555', bankName: 'بانک صادرات', accountHolder: 'آژانس جهانگردی پارسی', sheba: 'IR11112222333344445555', isDefault: true, status: 'ACTIVE' },
        { agencyId: agency4.id, cardNumber: 'tok_tejarat_7777', bankName: 'بانک تجارت', accountHolder: 'آژانس آسمان آبی', sheba: 'IR66667777888899990000', isDefault: true, status: 'ACTIVE' },
      ]
    });

    const bankCards = await prisma.bankCard.findMany();

    // ============ 6. ایجاد بلیط‌ها (۳۰ بلیط) - Fixed TypeScript Error ============
    console.log('🎫 ایجاد ۳۰ بلیط...');

    const cities = ['تهران', 'مشهد', 'اصفهان', 'شیراز', 'تبریز', 'بندرعباس', 'کیش', 'اهواز', 'رشت'];
    const flightNumbers = ['IR345', 'EP678', 'IR991', 'MAH456', 'W5-1234', 'QB789', 'AT456'];

    const ticketsData: Array<{
      ticketNumber: string;
      referenceNumber: string;
      agencyId: string;
      userId: string;
      passengerName: string;
      passengerPhone: string;
      flightNumber: string;
      origin: string;
      destination: string;
      flightDate: Date;
      seatClass: string;
      price: number;
      status: TicketStatus;
    }> = [];

    for (let i = 1; i <= 30; i++) {
      const agency = [agency1, agency2, agency3, agency4, agency5][i % 5];
      const user = normalUsers[i % normalUsers.length];

      ticketsData.push({
        ticketNumber: `TK${String(i).padStart(4, '0')}`,
        referenceNumber: `REF${String(i).padStart(4, '0')}`,
        agencyId: agency.id,
        userId: user.id,
        passengerName: `${['علی', 'فاطمه', 'محمد', 'زهرا', 'حسین', 'سارا'][i % 6]} ${['رضایی', 'احمدی', 'کریمی', 'محمدی', 'حسینی', 'بهرامی'][i % 6]}`,
        passengerPhone: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
        flightNumber: flightNumbers[i % flightNumbers.length],
        origin: cities[i % cities.length],
        destination: cities[(i + 4) % cities.length],
        flightDate: new Date(Date.now() + (i * 3 + 5) * 24 * 60 * 60 * 1000),
        seatClass: ['Economy', 'Business', 'First'][i % 3],
        price: Math.floor(Math.random() * 4500000) + 1200000,
        status: ['DRAFT', 'COMPLETED', 'FINALIZED', 'INVOICED'][Math.floor(i / 6) % 4] as TicketStatus,
      });
    }

    await prisma.ticket.createMany({ data: ticketsData });

    // ============ 7. فاکتور و پرداخت ============
    console.log('📄 ایجاد فاکتور و پرداخت...');

    const finalizedTickets = await prisma.ticket.findMany({
      where: { status: { in: ['FINALIZED', 'COMPLETED'] as TicketStatus[] } }
    });

    for (let i = 1; i <= 15; i++) {
      const ticket = finalizedTickets[i % finalizedTickets.length];
      const agency = [agency1, agency2, agency4][i % 3];
      const bankCard = bankCards.find(b => b.agencyId === agency.id)!;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-1403-${String(i).padStart(4, '0')}`,
          agencyId: agency.id,
          customerName: ticket.passengerName,
          customerPhone: ticket.passengerPhone,
          bankCardId: bankCard.id,
          templateStyle: (i % 3) + 1,
          subtotal: ticket.price,
          total: ticket.price,
          status: i % 3 === 0 ? 'PAID' : 'UNPAID',
          paidAt: i % 3 === 0 ? new Date() : undefined,
        }
      });

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: { invoiceId: invoice.id, status: 'INVOICED' }
      });

      if (i % 3 === 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            agencyId: agency.id,
            bankCardId: bankCard.id,
            amount: ticket.price,
            trackingCode: `TRK1403${String(i).padStart(4, '0')}`,
            status: 'COMPLETED',
            paidAt: new Date(),
          }
        });
      }
    }

    // ============ 8. تیکت پشتیبانی ============
    console.log('🛠️ ایجاد تیکت‌های پشتیبانی...');

    for (let i = 1; i <= 10; i++) {
      const agency = [agency1, agency2, agency4][i % 3];
      const user = createdUsers[i % createdUsers.length];

      const st = await prisma.supportTicket.create({
        data: {
          ticketNumber: `SUP-1403-${String(i).padStart(3, '0')}`,
          title: ['مشکل ورود به پنل', 'صدور فاکتور', 'گزارش‌گیری بلیط', 'درخواست افزایش کاربر', 'مشکل پرداخت آنلاین'][i % 5],
          description: 'با سلام، در استفاده از سیستم با مشکل مواجه شدم. لطفاً بررسی کنید.',
          senderType: 'AGENCY',
          agencyId: agency.id,
          userId: user.id,
          priority: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'][i % 4] as any,
          status: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'][i % 4] as any,
        }
      });

      await prisma.supportTicketReply.create({
        data: {
          ticketId: st.id,
          userId: superAdmin.id,
          message: 'در حال بررسی موضوع هستیم. به زودی نتیجه را اطلاع می‌دهیم.',
          isInternal: false,
        }
      });
    }

    // ============ 9. سایر داده‌ها ============
    console.log('📝 ایجاد سازمان‌ها، درخواست‌ها...');

    await prisma.organization.createMany({
      data: [
        { name: 'شرکت نفت فلات قاره', nationalId: '12345678901', phone: '021-44887766', email: 'info@nioec.ir', hasPanel: true },
        { name: 'بانک ملت', nationalId: '09876543210', phone: '021-12345678', email: 'info@bankmellat.ir', hasPanel: true },
      ]
    });

    await prisma.registrationRequest.createMany({
      data: [
        { agencyName: 'آژانس نور سفر', contactName: 'سارا احمدی', contactPhone: '09123456789', contactEmail: 'sara@noorsafar.ir', status: 'PENDING' },
        { agencyName: 'تورهای بهار', contactName: 'محمد حسینی', contactPhone: '09351234567', contactEmail: 'info@bahartour.ir', status: 'APPROVED' },
      ]
    });

    // ============ Summary ============
    console.log('\n🎉 ========== Seed با موفقیت انجام شد ========== 🎉');
    console.log(`   - پلن‌ها: ${await prisma.plan.count()}`);
    console.log(`   - آژانس‌ها: ${await prisma.agency.count()}`);
    console.log(`   - کاربران: ${await prisma.user.count()}`);
    console.log(`   - بلیط‌ها: ${await prisma.ticket.count()}`);
    console.log(`   - فاکتورها: ${await prisma.invoice.count()}`);
    console.log(`   - پرداخت‌ها: ${await prisma.payment.count()}`);
    console.log(`   - تیکت پشتیبانی: ${await prisma.supportTicket.count()}`);

  } catch (error) {
    console.error('❌ خطا در Seed:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 اتصال دیتابیس قطع شد');
  }
}

main();