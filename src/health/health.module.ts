import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HealthCheckContoller } from './health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { HealthService } from './health.service';
import { BullModule } from '@nestjs/bull';
import { QueueNames } from '../common/constants';
import { LoggerMiddleware } from '../common/middlewares/logger.middleware';

@Module({
  imports: [
    BullModule.registerQueue({ name: QueueNames.NEW_LOGS }, { name: QueueNames.LATE_LOGS }),
    TerminusModule,
  ],
  controllers: [HealthCheckContoller],
  providers: [HealthService],
})
export class HealthCheckModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes(HealthCheckContoller);
  }
}
