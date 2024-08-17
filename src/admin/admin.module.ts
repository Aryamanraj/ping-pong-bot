import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RepoModule } from '../repo/repo.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { LoggerMiddleware } from '../common/middlewares/logger.middleware';
import { QueueNames } from '../common/constants';
import { BullModule } from '@nestjs/bull';
import { CronsHealthController } from './health.controller';

@Module({
  imports: [
    RepoModule,
    BullModule.registerQueue({ name: QueueNames.NEW_LOGS }),
    ScheduleModule,
  ],
  controllers: [AdminController, CronsHealthController],
  providers: [AdminService],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes(AdminController, CronsHealthController);
  }
}
