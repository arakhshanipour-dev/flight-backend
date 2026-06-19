import { ApiProperty } from '@nestjs/swagger';

class ActionStatsDto {
  @ApiProperty()
  action!: string;

  @ApiProperty()
  count!: number;
}

class EntityTypeStatsDto {
  @ApiProperty()
  entityType!: string;

  @ApiProperty()
  count!: number;
}

class DailyStatsDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  count!: number;
}

export class ActivityLogStatsDto {
  @ApiProperty()
  totalLogs!: number;

  @ApiProperty({ type: [ActionStatsDto] })
  topActions!: ActionStatsDto[];

  @ApiProperty({ type: [EntityTypeStatsDto] })
  topEntityTypes!: EntityTypeStatsDto[];

  @ApiProperty({ type: [DailyStatsDto] })
  dailyStats!: DailyStatsDto[];

  @ApiProperty()
  lastWeekCount!: number;

  @ApiProperty()
  todayCount!: number;
}

export class UserActivitySummaryDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  totalActions!: number;

  @ApiProperty({ type: [ActionStatsDto] })
  topActions!: ActionStatsDto[];

  @ApiProperty()
  lastActivityAt!: Date;
}