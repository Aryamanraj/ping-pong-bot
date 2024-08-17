import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { QueueNames } from '../common/constants';
import { RepoModule } from '../repo/repo.module';
import { LogConsumer } from './consumers/log.consumer';
import { LogObserverService } from './services/log-observer.service';
import { RpcModule } from '../rpc/rpc.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: QueueNames.NEW_LOGS }),
    RepoModule,
    RpcModule,
  ],
  providers: [LogConsumer, LogObserverService],
  controllers: [],
})
export class ObserverModule {}
