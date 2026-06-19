import { Module, Global } from '@nestjs/common';
import { ActivityLogsController } from './activity-logs.controller';
import { ActivityLogsService } from './activity-logs.service';

@Global() // ✅ ماژول در سراسر برنامه در دسترس است
@Module({
  controllers: [ActivityLogsController],
  providers: [ActivityLogsService],
  exports: [ActivityLogsService],
})
export class ActivityLogsModule {}