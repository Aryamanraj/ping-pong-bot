import { Module } from '@nestjs/common';
import { RepoModule } from '../repo/repo.module';
import { BullModule } from '@nestjs/bull';
import { QueueNames } from '../common/constants';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [
    RepoModule,
    BullModule.registerQueue(
      { name: QueueNames.NEW_LOGS },
      { name: QueueNames.LATE_LOGS },
    ),
  ],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
