import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()  // در دسترس همه ماژول‌ها بدون نیاز به import
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}