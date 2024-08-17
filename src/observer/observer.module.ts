import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QueueNames } from '../common/constants';
import { RepoModule } from '../repo/repo.module';
import { LogConsumer } from './consumers/log.consumer';
import { LogObserverService } from './services/log-observer.service';
import { RpcModule } from '../rpc/rpc.module';
import { LateLogConsumer } from './consumers/late-log.consumer';
import { LateLogObserverService } from './services/late-log-observer.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QueueNames.NEW_LOGS },
      { name: QueueNames.LATE_LOGS },
    ),
    RepoModule,
    RpcModule,
  ],
  providers: [
    LogConsumer,
    LogObserverService,
    LateLogConsumer,
    LateLogObserverService,
  ],
  controllers: [],
})
export class ObserverModule {}
