import { Module } from '@nestjs/common';
import { RpcService } from './rpc.service';
import { BullModule } from '@nestjs/bull';
import { QueueNames } from '../common/constants';
import { ConfigModule } from '@nestjs/config';
import { RepoModule } from '../repo/repo.module';
import { HttpModule } from '@nestjs/axios';
@Module({
  imports: [
    ConfigModule,
    RepoModule,
    BullModule.registerQueue({ name: QueueNames.NEW_LOGS }),
    HttpModule,
  ],
  providers: [RpcService],
  exports: [RpcService],
})
export class RpcModule {}
