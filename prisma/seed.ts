// prisma/seed.ts
import { PrismaClient , AirportType} from '@prisma/client'
import 'dotenv/config';
import * as bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg';

// const prisma = new PrismaClient();
const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 شروع عملیات Seed دیتابیس...');

  try {
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    // ============ 1. پاکسازی داده‌های قبلی ============
    console.log('🗑️ پاکسازی داده‌های قبلی...');
    
    await prisma.$transaction([
      prisma.cashReceipt.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.invoice.deleteMany(),
      prisma.ticket.deleteMany(),
      prisma.penalty.deleteMany(),
      prisma.activityLog.deleteMany(),
      prisma.supportTicketReply.deleteMany(),
      prisma.supportTicket.deleteMany(),
      prisma.bankCard.deleteMany(),
      prisma.agencyPlan.deleteMany(),
      prisma.organizationMember.deleteMany(),
      prisma.user.deleteMany(),
      prisma.agency.deleteMany(),
      prisma.organization.deleteMany(),
      prisma.registrationRequest.deleteMany(),
      prisma.plan.deleteMany(),
      prisma.airline.deleteMany(),
      prisma.airport.deleteMany(),
    ]);

    // ============ 2. ایجاد فرودگاه‌ها ============
    console.log('✈️ ایجاد فرودگاه‌ها...');

    // 🔥 اصلاح: استفاده از Enum به جای string
    const airports = [
      // بین‌المللی
      { iataCode: 'MHD', icaoCode: 'OIMM', name: 'فرودگاه بین‌المللی شهید هاشمی‌نژاد', city: 'مشهد', province: 'خراسان رضوی', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'THR', icaoCode: 'OIII', name: 'فرودگاه بین‌المللی مهرآباد', city: 'تهران', province: 'تهران', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'IKA', icaoCode: 'OIIE', name: 'فرودگاه بین‌المللی امام خمینی', city: 'تهران', province: 'تهران', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'SYZ', icaoCode: 'OISS', name: 'فرودگاه بین‌المللی شهید دستغیب', city: 'شیراز', province: 'فارس', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'IFN', icaoCode: 'OIFM', name: 'فرودگاه بین‌المللی شهید بهشتی', city: 'اصفهان', province: 'اصفهان', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'TBZ', icaoCode: 'OITT', name: 'فرودگاه بین‌المللی شهید مدنی', city: 'تبریز', province: 'آذربایجان شرقی', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'KIH', icaoCode: 'OIBK', name: 'فرودگاه بین‌المللی کیش', city: 'کیش', province: 'هرمزگان', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'BND', icaoCode: 'OIKB', name: 'فرودگاه بین‌المللی بندرعباس', city: 'بندرعباس', province: 'هرمزگان', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'AWZ', icaoCode: 'OIAW', name: 'فرودگاه بین‌المللی اهواز', city: 'اهواز', province: 'خوزستان', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'ABD', icaoCode: 'OIAA', name: 'فرودگاه بین‌المللی آبادان', city: 'آبادان', province: 'خوزستان', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'GSM', icaoCode: 'OIKQ', name: 'فرودگاه دیرستان (قشم)', city: 'قشم', province: 'هرمزگان', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'LRR', icaoCode: 'OISL', name: 'فرودگاه بین‌المللی لارستان', city: 'لارستان', province: 'فارس', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'PYK', icaoCode: 'OIIP', name: 'فرودگاه بین‌المللی پیام', city: 'کرج', province: 'البرز', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'ADU', icaoCode: 'OITL', name: 'فرودگاه بین‌المللی اردبیل', city: 'اردبیل', province: 'اردبیل', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'AZD', icaoCode: 'OIYY', name: 'فرودگاه شهید صدوقی', city: 'یزد', province: 'یزد', type: AirportType.INTERNATIONAL, country: 'IRAN', timezone: 'Asia/Tehran' },
      
      // مرز هوایی (BORDER)
      { iataCode: 'XBJ', icaoCode: 'OIMB', name: 'فرودگاه بیرجند', city: 'بیرجند', province: 'خراسان جنوبی', type: AirportType.BORDER, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'OMH', icaoCode: 'OITR', name: 'فرودگاه شهید باکری', city: 'ارومیه', province: 'آذربایجان غربی', type: AirportType.BORDER, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'BUZ', icaoCode: 'OIBB', name: 'فرودگاه بوشهر', city: 'بوشهر', province: 'بوشهر', type: AirportType.BORDER, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'ZBR', icaoCode: 'OIZC', name: 'فرودگاه کنارک (چابهار)', city: 'چابهار', province: 'سیستان و بلوچستان', type: AirportType.BORDER, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'RAS', icaoCode: 'OIGG', name: 'فرودگاه رشت', city: 'رشت', province: 'گیلان', type: AirportType.BORDER, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'KSH', icaoCode: 'OICC', name: 'فرودگاه بین‌المللی کرمانشاه', city: 'کرمانشاه', province: 'کرمانشاه', type: AirportType.BORDER, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'KER', icaoCode: 'OIKK', name: 'فرودگاه بین‌المللی کرمان', city: 'کرمان', province: 'کرمان', type: AirportType.BORDER, country: 'IRAN', timezone: 'Asia/Tehran' },
      
      // داخلی (DOMESTIC)
      { iataCode: 'KHY', icaoCode: 'OITK', name: 'فرودگاه خوی', city: 'خوی', province: 'آذربایجان غربی', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'IIL', icaoCode: 'OICI', name: 'فرودگاه ایلام', city: 'ایلام', province: 'ایلام', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'CQD', icaoCode: 'OIFS', name: 'فرودگاه شهرکرد', city: 'شهرکرد', province: 'چهارمحال بختیاری', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'MRX', icaoCode: 'OIAM', name: 'فرودگاه ماهشهر', city: 'ماهشهر', province: 'خوزستان', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'ZAH', icaoCode: 'OIZH', name: 'فرودگاه بین‌المللی زاهدان', city: 'زاهدان', province: 'سیستان و بلوچستان', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'FAZ', icaoCode: 'OISF', name: 'فرودگاه فسا', city: 'فسا', province: 'فارس', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'KLM', icaoCode: 'OINE', name: 'فرودگاه کلاله', city: 'کلاله', province: 'گلستان', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      { iataCode: 'AJK', icaoCode: 'OIHR', name: 'فرودگاه اراک', city: 'اراک', province: 'مرکزی', type: AirportType.DOMESTIC, country: 'IRAN', timezone: 'Asia/Tehran' },
      
      // خارجی (INTERNATIONAL با کشورهای دیگر)
      { iataCode: 'DXB', icaoCode: 'OMDB', name: 'فرودگاه بین‌المللی دبی', city: 'دبی', province: 'دبی', type: AirportType.INTERNATIONAL, country: 'UAE', timezone: 'Asia/Dubai' },
      { iataCode: 'NJF', icaoCode: 'ORNI', name: 'فرودگاه بین‌المللی نجف', city: 'نجف', province: 'نجف', type: AirportType.INTERNATIONAL, country: 'IRAQ', timezone: 'Asia/Baghdad' },
    ];

    // 🔥 استفاده از createMany با داده‌های اصلاح شده
    await prisma.airport.createMany({
      data: airports,
      skipDuplicates: true,
    });

    console.log(`✅ ${airports.length} فرودگاه ایجاد شد`);

    // ============ 3. ایجاد شرکت‌های هواپیمایی ============
    console.log('✈️ ایجاد شرکت‌های هواپیمایی...');

    const airlines = [
      { iataCode: 'IR', icaoCode: 'IRA', name: 'هواپیمایی جمهوری اسلامی ایران (ایران‌ایر)', country: 'IRAN' },
      { iataCode: 'W5', icaoCode: 'IRM', name: 'هواپیمایی ماهان', country: 'IRAN' },
      { iataCode: 'EP', icaoCode: 'IRC', name: 'هواپیمایی آسمان', country: 'IRAN' },
      { iataCode: 'ZV', icaoCode: 'IRZ', name: 'هواپیمایی زاگرس', country: 'IRAN' },
      { iataCode: 'IS', icaoCode: 'IRN', name: 'هواپیمایی سپهران', country: 'IRAN' },
      { iataCode: 'IV', icaoCode: 'IRP', name: 'هواپیمایی کیش', country: 'IRAN' },
      { iataCode: 'IA', icaoCode: 'IRB', name: 'هواپیمایی ایران ایرتور', country: 'IRAN' },
      { iataCode: 'SA', icaoCode: 'IRG', name: 'هواپیمایی ساها', country: 'IRAN' },
      { iataCode: 'TK', icaoCode: 'THY', name: 'ترکیش ایرلاینز', country: 'TURKEY' },
      { iataCode: 'EK', icaoCode: 'UAE', name: 'امارات ایرلاین', country: 'UAE' },
      { iataCode: 'QR', icaoCode: 'QTR', name: 'قطر ایرویز', country: 'QATAR' },
    ];

    await prisma.airline.createMany({
      data: airlines,
      skipDuplicates: true,
    });

    console.log(`✅ ${airlines.length} شرکت هواپیمایی ایجاد شد`);

    // ============ 4. ایجاد پلن‌ها ============
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
          features: { "hasAPI": false, "hasSupport": true, "hasReport": false },
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
          features: { "hasAPI": true, "hasSupport": true, "hasReport": true },
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
          features: { "hasAPI": true, "hasSupport": true, "hasReport": true, "hasCustomDomain": true },
          isActive: true 
        },
      ],
    });

    const plans = await prisma.plan.findMany();
    const basicPlan = plans.find(p => p.name === 'Basic')!;
    const proPlan = plans.find(p => p.name === 'Pro')!;
    const enterprisePlan = plans.find(p => p.name === 'Enterprise')!;

    // ============ 5. ایجاد آژانس‌ها ============
    console.log('🏢 ایجاد آژانس‌ها...');

    const agencies = await Promise.all([
      prisma.agency.create({ data: { 
        name: 'آژانس سفر پلاس', 
        registrationNumber: 'REG-14031234', 
        phone: '021-88551234', 
        email: 'info@travelplus.ir', 
        address: 'تهران، خیابان ولیعصر، پلاک ۱۲۳۴', 
        status: 'ACTIVE',
        iataCode: 'TP001'
      }}),
      prisma.agency.create({ data: { 
        name: 'آژانس جهانگردی پارسی', 
        registrationNumber: 'REG-14035678', 
        phone: '021-77654321', 
        email: 'info@parsiworld.ir', 
        address: 'مشهد، خیابان احمدآباد، پلاک ۵۶۷', 
        status: 'ACTIVE',
        iataCode: 'PW002'
      }}),
      prisma.agency.create({ data: { 
        name: 'آژانس پرواز طلایی', 
        registrationNumber: 'REG-14039876', 
        phone: '031-31345678', 
        email: 'goldfly@agency.ir', 
        address: 'اصفهان، خیابان امام، مجتمع تجاری ۹۸', 
        status: 'TRIAL',
        iataCode: 'GF003'
      }}),
      prisma.agency.create({ data: { 
        name: 'آژانس آسمان آبی', 
        registrationNumber: 'REG-14036543', 
        phone: '051-38456789', 
        email: 'blue@skyagency.ir', 
        address: 'شیراز، بلوار چمران، پلاک ۷۸۹', 
        status: 'ACTIVE',
        iataCode: 'SA004'
      }}),
      prisma.agency.create({ data: { 
        name: 'آژانس پرواز ققنوس', 
        registrationNumber: 'REG-14037890', 
        phone: '021-22987654', 
        email: 'phoenix@travel.ir', 
        address: 'تهران، فرمانیه، خیابان دیداری', 
        status: 'ACTIVE',
        iataCode: 'PP005'
      }})
    ]);

    const [agency1, agency2, agency3, agency4, agency5] = agencies;

    // Assign Plans
    await prisma.agencyPlan.createMany({
      data: [
        { agencyId: agency1.id, planId: proPlan.id, startDate: new Date(), endDate: new Date(Date.now() + 365*24*60*60*1000), isActive: true },
        { agencyId: agency2.id, planId: basicPlan.id, startDate: new Date(), endDate: new Date(Date.now() + 365*24*60*60*1000), isActive: true },
        { agencyId: agency3.id, planId: basicPlan.id, startDate: new Date(), endDate: null, isActive: true },
        { agencyId: agency4.id, planId: enterprisePlan.id, startDate: new Date(), endDate: new Date(Date.now() + 730*24*60*60*1000), isActive: true },
        { agencyId: agency5.id, planId: proPlan.id, startDate: new Date(), endDate: new Date(Date.now() + 180*24*60*60*1000), isActive: true },
      ]
    });

    // ============ 6. ایجاد کاربران ============
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

    // ============ 7. ایجاد سازمان‌ها و اعضا ============
    console.log('🏛️ ایجاد سازمان‌ها...');

    const org1 = await prisma.organization.create({
      data: {
        name: 'شرکت نفت فلات قاره',
        nationalId: '12345678901',
        phone: '021-44887766',
        email: 'info@nioec.ir',
        hasPanel: true,
        panelCreatedAt: new Date(),
      }
    });

    const org2 = await prisma.organization.create({
      data: {
        name: 'بانک ملت',
        nationalId: '09876543210',
        phone: '021-12345678',
        email: 'info@bankmellat.ir',
        hasPanel: true,
        panelCreatedAt: new Date(),
      }
    });

    // ایجاد اعضای سازمان
    const orgAdminUser = await prisma.user.create({
      data: {
        email: 'orgadmin@nioec.ir',
        passwordHash: hashedPassword,
        firstName: 'رضا',
        lastName: 'مدیری',
        phone: '09121234567',
        role: 'ORGANIZATION_ADMIN',
        status: 'ACTIVE',
        organizationId: org1.id,
      }
    });

    await prisma.organizationMember.createMany({
      data: [
        { organizationId: org1.id, userId: orgAdminUser.id, role: 'ADMIN' },
        { organizationId: org1.id, userId: normalUsers[0].id, role: 'MEMBER' },
        { organizationId: org2.id, userId: normalUsers[1].id, role: 'VIEWER' },
      ]
    });

    // ============ 8. کارت‌های بانکی ============
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

    // ============ 9. ایجاد بلیط‌ها ============
    console.log('🎫 ایجاد بلیط‌های نمونه...');

    const airportsMap = await prisma.airport.findMany();
    const airlinesMap = await prisma.airline.findMany();

    const getAirportId = (iataCode: string) => {
      const airport = airportsMap.find(a => a.iataCode === iataCode);
      return airport?.id || null;
    };

    const getAirlineId = (iataCode: string) => {
      const airline = airlinesMap.find(a => a.iataCode === iataCode);
      return airline?.id || null;
    };

    const sampleTickets = [
      {
        ticketNumber: '109184430',
        referenceNumber: '13141534',
        pnr: 'IKEKIN',
        passengerName: 'HOSSEIN SAFARI',
        passengerPhone: '09156667834',
        passengerTitle: 'Mr',
        nationality: 'IRN',
        nationalCode: '0880300779',
        passportNumber: 'F100752516',
        reservationPhone: '09157930609',
        ageType: 'ADT',
        gender: 'MALE',
        flightNumber: '7310',
        departureDate: new Date('2025-10-07T06:45:00'),
        seatClass: 'E',
        route: 'MHD-NJF',
        source: 'sepehran-web',
        customerAirline: 'هواپیمایی سپهران',
        sign: 'آژانس کویران بیرجند',
        currencyCode: 'IRR',
        fare: 24748863,
        tax: 9113740,
        vat: 91137397,
        commission: 6,
        commissionAmount: 5468244,
        price: 125000000,
        salesType: 'STANDARD',
        transactionType: 'TICKET',
        transactionDate: new Date('2025-10-01T13:30:22'),
        agentName: 'آژانس کویران بیرجند',
        agentCode: 'XBJ17095',
        agentIATACode: '43013',
        status: 'FINALIZED',
        agencyId: agency1.id,
        userId: normalUsers[0].id,
        originAirportId: getAirportId('MHD'),
        destinationAirportId: getAirportId('NJF'),
        airlineId: getAirlineId('IS'),
      },
      {
        ticketNumber: '109184429',
        referenceNumber: '13141534',
        pnr: 'IKEKIN',
        passengerName: 'FATEMEH MOLLAEI',
        passengerPhone: '09156667834',
        passengerTitle: 'Mrs',
        nationality: 'IRN',
        nationalCode: '0880326786',
        passportNumber: 'F100784262',
        reservationPhone: '09157930609',
        ageType: 'ADT',
        gender: 'FEMALE',
        flightNumber: '7310',
        departureDate: new Date('2025-10-07T06:45:00'),
        seatClass: 'E',
        route: 'MHD-NJF',
        source: 'sepehran-web',
        customerAirline: 'هواپیمایی سپهران',
        sign: 'آژانس کویران بیرجند',
        currencyCode: 'IRR',
        fare: 24748863,
        tax: 9113740,
        vat: 91137397,
        commission: 6,
        commissionAmount: 5468244,
        price: 125000000,
        salesType: 'STANDARD',
        transactionType: 'TICKET',
        transactionDate: new Date('2025-10-01T13:30:22'),
        agentName: 'آژانس کویران بیرجند',
        agentCode: 'XBJ17095',
        agentIATACode: '43013',
        status: 'FINALIZED',
        agencyId: agency1.id,
        userId: normalUsers[1].id,
        originAirportId: getAirportId('MHD'),
        destinationAirportId: getAirportId('NJF'),
        airlineId: getAirlineId('IS'),
      },
      // ... بلیط‌های بیشتر (برای اختصار حذف شد)
    ];

    // ایجاد بلیط‌ها
    for (const ticketData of sampleTickets) {
      await prisma.ticket.create({ data: ticketData as any });
    }

    console.log(`✅ ${sampleTickets.length} بلیط نمونه ایجاد شد`);

    // ============ 10. فاکتور و پرداخت ============
    console.log('📄 ایجاد فاکتور و پرداخت...');

    const tickets = await prisma.ticket.findMany({
      where: { status: 'FINALIZED' }
    });

    if (tickets.length > 0) {
      const firstTicket = tickets[0];
      
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${Date.now()}`,
          agencyId: firstTicket.agencyId,
          customerName: firstTicket.passengerName,
          customerPhone: firstTicket.passengerPhone,
          bankCardId: bankCards[0]?.id,
          subtotal: firstTicket.fare,
          total: firstTicket.price,
          status: 'UNPAID',
          issuedAt: new Date(),
          salesType: 'STANDARD',
          currencyCode: 'IRR',
          markup: firstTicket.markup,
        }
      });

      // اتصال بلیط به فاکتور
      await prisma.ticket.update({
        where: { id: firstTicket.id },
        data: { invoiceId: invoice.id }
      });

      // ایجاد پرداخت
      await prisma.payment.create({
        data: {
          invoiceId: invoice.id,
          agencyId: invoice.agencyId,
          bankCardId: bankCards[0]?.id,
          amount: invoice.total,
          paymentMethod: 'CREDIT',
          status: 'PENDING',
          currencyCode: 'IRR',
        }
      });
    }

    // ============ 11. تیکت‌های پشتیبانی ============
    console.log('🎫 ایجاد تیکت‌های پشتیبانی...');

    const supportTicket = await prisma.supportTicket.create({
      data: {
        ticketNumber: `SUP-${Date.now()}`,
        title: 'مشکل در صدور بلیط',
        description: 'هنگام صدور بلیط خطای سیستم دریافت می‌کنم',
        status: 'OPEN',
        priority: 'HIGH',
        senderType: 'AGENCY',
        agencyId: agency1.id,
        userId: normalUsers[0].id,
      }
    });

    await prisma.supportTicketReply.create({
      data: {
        ticketId: supportTicket.id,
        userId: normalUsers[0].id,
        message: 'لطفاً راهنمایی بفرمایید',
        isInternal: false,
      }
    });

    // ============ 12. سایر داده‌ها ============
    console.log('📝 ایجاد درخواست‌های ثبت‌نام...');

    await prisma.registrationRequest.createMany({
      data: [
        { agencyName: 'آژانس نور سفر', contactName: 'سارا احمدی', contactPhone: '09123456789', contactEmail: 'sara@noorsafar.ir', status: 'PENDING' },
        { agencyName: 'تورهای بهار', contactName: 'محمد حسینی', contactPhone: '09351234567', contactEmail: 'info@bahartour.ir', status: 'APPROVED' },
      ]
    });

    // ============ Summary ============
    console.log('\n🎉 ========== Seed با موفقیت انجام شد ========== 🎉');
    console.log(`   - فرودگاه‌ها: ${await prisma.airport.count()}`);
    console.log(`   - شرکت‌های هواپیمایی: ${await prisma.airline.count()}`);
    console.log(`   - پلن‌ها: ${await prisma.plan.count()}`);
    console.log(`   - آژانس‌ها: ${await prisma.agency.count()}`);
    console.log(`   - کاربران: ${await prisma.user.count()}`);
    console.log(`   - سازمان‌ها: ${await prisma.organization.count()}`);
    console.log(`   - بلیط‌ها: ${await prisma.ticket.count()}`);
    console.log(`   - فاکتورها: ${await prisma.invoice.count()}`);
    console.log(`   - پرداخت‌ها: ${await prisma.payment.count()}`);
    console.log(`   - تیکت پشتیبانی: ${await prisma.supportTicket.count()}`);

  } catch (error) {
    console.error('❌ خطا در Seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 اتصال دیتابیس قطع شد');
  }
}

main();